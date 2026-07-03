"""
Backward compatibility tests: V1→V2 manifest auto-upgrade.

Tests that V1 manifests (without schema_version) are properly upgraded to V2
(with schema_version and plugins array) without data loss or silent failures.
"""

import json
import pytest
from pathlib import Path
from tempfile import TemporaryDirectory

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from manifest_validator import (
    detect_schema_version,
    auto_upgrade_v1_to_v2,
    validate_manifest,
    PLUGIN_REGISTRY,
)


class TestV1toV2Upgrade:
    """Test V1→V2 auto-upgrade on representative project types."""

    def test_upgrade_youtube_project(self):
        """V1 youtube project upgrades to V2 with youtube-core plugin enabled."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create V1 youtube manifest (no schema_version)
            manifest_v1 = {
                "project_name": "My YouTube Channel",
                "project_type": "youtube",
                "auto_include": True,
                "active_skills": ["banana-prompt"],
                "disabled_skills": [],
                "metadata": {"channel_id": "UC12345"},
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            # Verify it's detected as V1
            result = validate_manifest(manifest_path)
            assert result.valid is True
            assert result.schema_version == "1.0.0"

            # Perform auto-upgrade (does not write to disk)
            with open(manifest_path) as f:
                manifest = json.load(f)
            manifest_v2 = auto_upgrade_v1_to_v2(manifest)

            # Verify V2 structure
            assert manifest_v2["schema_version"] == "2.0.0"
            assert "plugins" in manifest_v2
            assert isinstance(manifest_v2["plugins"], list)

            # Verify youtube-core plugin is included
            plugin_ids = [p["plugin_id"] for p in manifest_v2["plugins"]]
            assert "youtube-core" in plugin_ids

            # Verify plugin is enabled by default
            youtube_core = next(
                (p for p in manifest_v2["plugins"] if p["plugin_id"] == "youtube-core"),
                None
            )
            assert youtube_core is not None
            assert youtube_core.get("enabled", True) is True

            # Verify ALL V1 fields preserved unchanged (no data loss)
            assert manifest_v2["project_name"] == "My YouTube Channel"
            assert manifest_v2["project_type"] == "youtube"
            assert manifest_v2["auto_include"] is True
            assert manifest_v2["active_skills"] == ["banana-prompt"]
            assert manifest_v2["disabled_skills"] == []
            assert manifest_v2["metadata"]["channel_id"] == "UC12345"

    def test_upgrade_code_project(self):
        """V1 code project upgrades to V2 with code-mcp-tools plugin enabled."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create V1 code manifest
            manifest_v1 = {
                "project_name": "Backend API",
                "project_type": "code",
                "auto_include": False,
                "active_skills": ["python-patterns", "systematic-debugging"],
                "disabled_skills": ["youtube-strategy"],
                "metadata": {"owner": "dev-team@example.com"},
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            # Verify it's V1
            result = validate_manifest(manifest_path)
            assert result.valid is True
            assert result.schema_version == "1.0.0"

            # Auto-upgrade
            with open(manifest_path) as f:
                manifest = json.load(f)
            manifest_v2 = auto_upgrade_v1_to_v2(manifest)

            # Verify V2 structure
            assert manifest_v2["schema_version"] == "2.0.0"
            assert "plugins" in manifest_v2

            # Verify code-mcp-tools plugin included
            plugin_ids = [p["plugin_id"] for p in manifest_v2["plugins"]]
            assert "code-mcp-tools" in plugin_ids

            # Verify V1 fields preserved
            assert manifest_v2["project_type"] == "code"
            assert manifest_v2["auto_include"] is False
            assert manifest_v2["active_skills"] == ["python-patterns", "systematic-debugging"]
            assert manifest_v2["disabled_skills"] == ["youtube-strategy"]

    def test_upgrade_hybrid_project(self):
        """V1 hybrid project upgrades to V2 with empty plugins array (no implicit plugins)."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create V1 hybrid manifest
            manifest_v1 = {
                "project_name": "Multi-Domain Project",
                "project_type": "hybrid",
                "auto_include": True,
                "active_skills": ["python-patterns"],
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            # Verify it's V1
            result = validate_manifest(manifest_path)
            assert result.valid is True
            assert result.schema_version == "1.0.0"

            # Auto-upgrade
            with open(manifest_path) as f:
                manifest = json.load(f)
            manifest_v2 = auto_upgrade_v1_to_v2(manifest)

            # Verify V2 structure (hybrid has no implicit plugins)
            assert manifest_v2["schema_version"] == "2.0.0"
            assert "plugins" in manifest_v2
            assert manifest_v2["plugins"] == []  # Hybrid gets empty array

            # Verify V1 fields preserved
            assert manifest_v2["project_type"] == "hybrid"
            assert manifest_v2["auto_include"] is True
            assert manifest_v2["active_skills"] == ["python-patterns"]

    def test_upgrade_preserves_all_v1_fields(self):
        """Comprehensive test: upgrade preserves all V1 fields unchanged (no data loss)."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"

            # Create complex V1 manifest with many fields
            manifest_v1 = {
                "project_name": "Complex Project",
                "project_type": "geometry",
                "auto_include": True,
                "active_skills": ["cd-foundations", "python-patterns"],
                "disabled_skills": ["youtube-retention", "youtube-scriptwriting"],
                "metadata": {
                    "owner": "test@example.com",
                    "tags": ["geometry", "rhino", "grasshopper"],
                    "custom_field": "custom_value",
                    "nested": {
                        "level2": {
                            "level3": "deep_value"
                        }
                    },
                },
                "description": "A test project for geometry work",
                "extra_field": 42,
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            # Auto-upgrade
            with open(manifest_path) as f:
                manifest = json.load(f)
            manifest_v2 = auto_upgrade_v1_to_v2(manifest)

            # Verify all V1 fields are unchanged (no modification, no deletion)
            for key, value in manifest_v1.items():
                assert key in manifest_v2, f"Field {key} was deleted during upgrade"
                assert manifest_v2[key] == value, f"Field {key} was modified during upgrade"

            # Verify only new V2 fields were added (no extra fields)
            v2_only_fields = set(manifest_v2.keys()) - set(manifest_v1.keys())
            assert v2_only_fields == {"schema_version", "plugins"}, \
                f"Unexpected fields added: {v2_only_fields}"

    def test_upgrade_idempotent(self):
        """Upgrading an already-V2 manifest returns it unchanged (idempotent)."""
        manifest_v2_original = {
            "project_type": "youtube",
            "schema_version": "2.0.0",
            "auto_include": True,
            "plugins": [{"plugin_id": "youtube-core", "enabled": True}],
            "active_skills": ["banana-prompt"],
        }

        # Run upgrade on already-V2 manifest
        manifest_v2_result = auto_upgrade_v1_to_v2(manifest_v2_original)

        # Should be unchanged (except for deep copy)
        assert manifest_v2_result == manifest_v2_original

    def test_three_project_types_roundtrip(self):
        """Test auto-upgrade on 3 representative project types."""
        test_cases = [
            ("youtube", {
                "project_type": "youtube",
                "auto_include": True,
                "active_skills": ["banana-prompt"],
            }),
            ("code", {
                "project_type": "code",
                "auto_include": False,
                "active_skills": ["python-mcp", "typescript-mcp"],
            }),
            ("geometry", {
                "project_type": "geometry",
                "auto_include": True,
                "active_skills": [],
            }),
        ]

        for project_type, manifest_v1 in test_cases:
            with TemporaryDirectory() as tmpdir:
                tmpdir = Path(tmpdir)
                project_root = tmpdir / "project"
                project_root.mkdir()
                manifest_path = project_root / "project.json"
                manifest_path.write_text(json.dumps(manifest_v1))

                # Step 1: Validate V1 manifest
                result = validate_manifest(manifest_path)
                assert result.valid is True, f"{project_type} V1 validation failed"
                assert result.schema_version == "1.0.0", f"{project_type} not detected as V1"

                # Step 2: Auto-upgrade
                with open(manifest_path) as f:
                    manifest = json.load(f)
                manifest_v2 = auto_upgrade_v1_to_v2(manifest)

                # Step 3: Verify V2 structure
                assert manifest_v2["schema_version"] == "2.0.0", \
                    f"{project_type} upgrade failed: no schema_version"
                assert "plugins" in manifest_v2, \
                    f"{project_type} upgrade failed: no plugins array"
                assert isinstance(manifest_v2["plugins"], list), \
                    f"{project_type} plugins is not a list"

                # Step 4: Verify upgraded manifest validates as V2
                manifest_path.write_text(json.dumps(manifest_v2))
                result_v2 = validate_manifest(manifest_path)
                assert result_v2.valid is True, \
                    f"Upgraded {project_type} manifest failed V2 validation"
                assert result_v2.schema_version == "2.0.0", \
                    f"Upgraded {project_type} not detected as V2"

                # Step 5: Verify V1 fields preserved
                for key, value in manifest_v1.items():
                    assert manifest_v2[key] == value, \
                        f"{project_type}: Field {key} was modified"

    def test_upgrade_infers_correct_plugins(self):
        """Verify that plugin inference matches project type (not arbitrary)."""
        test_cases = [
            ("youtube", "youtube-core"),
            ("pptx", "pptx-core"),
            ("code", "code-mcp-tools"),
            ("geometry", "geometry-rhino"),
            ("pbi-report", "pbi-core"),
            ("manuscript", "manuscript-tools"),
        ]

        for project_type, expected_plugin in test_cases:
            manifest_v1 = {
                "project_type": project_type,
                "auto_include": True,
            }
            manifest_v2 = auto_upgrade_v1_to_v2(manifest_v1)

            plugin_ids = [p["plugin_id"] for p in manifest_v2["plugins"]]
            assert expected_plugin in plugin_ids, \
                f"{project_type} upgrade: expected {expected_plugin}, got {plugin_ids}"

    def test_upgrade_silent_and_correct(self):
        """Ensure upgrade is silent (no warnings) and correct (no data loss)."""
        manifest_v1 = {
            "project_name": "Test Project",
            "project_type": "code",
            "auto_include": False,
            "active_skills": ["python-patterns"],
            "disabled_skills": [],
            "metadata": {"version": "1.0"},
        }

        # Upgrade
        manifest_v2 = auto_upgrade_v1_to_v2(manifest_v1)

        # Verify: No fields lost
        for key in manifest_v1.keys():
            assert key in manifest_v2, f"Field {key} lost during upgrade"
            assert manifest_v2[key] == manifest_v1[key], f"Field {key} modified"

        # Verify: Correct new fields added
        assert manifest_v2["schema_version"] == "2.0.0"
        assert "plugins" in manifest_v2
        assert isinstance(manifest_v2["plugins"], list)
        assert all(
            isinstance(p, dict) and "plugin_id" in p
            for p in manifest_v2["plugins"]
        ), "Plugins array malformed"


class TestBackwardCompatibility:
    """Ensure V1 and V2 manifests work side-by-side."""

    def test_v1_manifest_still_validates(self):
        """Legacy V1 manifest (no schema_version) remains valid."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"

            # Real-world V1 manifest
            manifest_v1 = {
                "project_name": "Legacy Project",
                "project_type": "code",
                "auto_include": True,
                "active_skills": ["python-mcp"],
                "disabled_skills": ["youtube-strategy"],
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            # Should validate without modification
            result = validate_manifest(manifest_path)
            assert result.valid is True
            assert result.schema_version == "1.0.0"

    def test_v2_manifest_validates(self):
        """New V2 manifest with plugins array validates."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"

            manifest_v2 = {
                "project_name": "Modern Project",
                "project_type": "geometry",
                "schema_version": "2.0.0",
                "auto_include": True,
                "plugins": [{"plugin_id": "geometry-rhino", "enabled": True}],
            }
            manifest_path.write_text(json.dumps(manifest_v2))

            result = validate_manifest(manifest_path)
            assert result.valid is True
            assert result.schema_version == "2.0.0"

    def test_v1_and_v2_can_coexist(self):
        """V1 and V2 manifests can be used in same codebase."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create two projects: one V1, one V2
            v1_project = tmpdir / "v1_project"
            v2_project = tmpdir / "v2_project"
            v1_project.mkdir()
            v2_project.mkdir()

            # V1 manifest
            v1_manifest_path = v1_project / "project.json"
            v1_manifest_path.write_text(json.dumps({
                "project_type": "code",
                "auto_include": True,
            }))

            # V2 manifest
            v2_manifest_path = v2_project / "project.json"
            v2_manifest_path.write_text(json.dumps({
                "project_type": "code",
                "schema_version": "2.0.0",
                "auto_include": True,
                "plugins": [{"plugin_id": "code-mcp-tools", "enabled": True}],
            }))

            # Both should validate
            v1_result = validate_manifest(v1_manifest_path)
            v2_result = validate_manifest(v2_manifest_path)

            assert v1_result.valid is True
            assert v1_result.schema_version == "1.0.0"
            assert v2_result.valid is True
            assert v2_result.schema_version == "2.0.0"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
