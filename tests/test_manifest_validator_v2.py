"""
Unit tests for manifest_validator.py V1 and V2 schema support.

Tests schema detection, V1→V2 auto-upgrade, plugin validation, and backward compatibility.
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
    validate_plugins,
    analyze_manifest,
    PLUGIN_REGISTRY,
    DEFAULT_SKILLS,
)


class TestSchemaDetection:
    """Test detect_schema_version() function."""

    def test_v1_detection_missing_schema_version(self):
        """Old manifest without schema_version is detected as V1."""
        manifest_v1 = {
            "project_type": "youtube",
            "auto_include": True,
            "active_skills": [],
        }
        assert detect_schema_version(manifest_v1) == "1.0.0"

    def test_v2_detection_with_schema_version(self):
        """New manifest with schema_version field is detected as V2."""
        manifest_v2 = {
            "project_type": "youtube",
            "schema_version": "2.0.0",
            "auto_include": True,
            "plugins": [],
        }
        assert detect_schema_version(manifest_v2) == "2.0.0"

    def test_v2_detection_with_schema_version_any_value(self):
        """Presence of schema_version field indicates V2 (even if value differs)."""
        manifest = {
            "project_type": "code",
            "schema_version": "1.5.0",
        }
        assert detect_schema_version(manifest) == "2.0.0"


class TestV1toV2Upgrade:
    """Test auto_upgrade_v1_to_v2() function."""

    def test_upgrade_youtube_project(self):
        """V1 youtube project upgrades to V2 with youtube-core plugin."""
        manifest_v1 = {
            "project_type": "youtube",
            "auto_include": True,
            "active_skills": ["banana-prompt"],
        }
        manifest_v2 = auto_upgrade_v1_to_v2(manifest_v1)

        assert manifest_v2["schema_version"] == "2.0.0"
        assert "plugins" in manifest_v2
        plugin_ids = [p["plugin_id"] for p in manifest_v2["plugins"]]
        assert "youtube-core" in plugin_ids

    def test_upgrade_geometry_project(self):
        """V1 geometry project upgrades to V2 with geometry-rhino plugin."""
        manifest_v1 = {
            "project_type": "geometry",
            "auto_include": True,
        }
        manifest_v2 = auto_upgrade_v1_to_v2(manifest_v1)

        assert manifest_v2["schema_version"] == "2.0.0"
        plugin_ids = [p["plugin_id"] for p in manifest_v2["plugins"]]
        assert "geometry-rhino" in plugin_ids

    def test_upgrade_code_project(self):
        """V1 code project upgrades to V2 with code-mcp-tools plugin."""
        manifest_v1 = {
            "project_type": "code",
            "auto_include": False,
            "active_skills": ["python-patterns"],
        }
        manifest_v2 = auto_upgrade_v1_to_v2(manifest_v1)

        assert manifest_v2["schema_version"] == "2.0.0"
        plugin_ids = [p["plugin_id"] for p in manifest_v2["plugins"]]
        assert "code-mcp-tools" in plugin_ids

    def test_upgrade_preserves_all_v1_fields(self):
        """Upgrade preserves all V1 fields unchanged."""
        manifest_v1 = {
            "project_name": "My Project",
            "project_type": "manuscript",
            "auto_include": True,
            "active_skills": ["business-analyst"],
            "disabled_skills": ["youtube-strategy"],
            "metadata": {"custom_field": "value"},
        }
        manifest_v2 = auto_upgrade_v1_to_v2(manifest_v1)

        # V1 fields preserved
        assert manifest_v2["project_name"] == "My Project"
        assert manifest_v2["project_type"] == "manuscript"
        assert manifest_v2["auto_include"] is True
        assert manifest_v2["active_skills"] == ["business-analyst"]
        assert manifest_v2["disabled_skills"] == ["youtube-strategy"]
        assert manifest_v2["metadata"] == {"custom_field": "value"}

        # V2 fields added
        assert manifest_v2["schema_version"] == "2.0.0"
        assert "plugins" in manifest_v2

    def test_upgrade_idempotent(self):
        """Upgrading an already-V2 manifest returns it unchanged."""
        manifest_v2_original = {
            "project_type": "youtube",
            "schema_version": "2.0.0",
            "plugins": [{"plugin_id": "youtube-core", "enabled": True}],
        }
        manifest_v2_result = auto_upgrade_v1_to_v2(manifest_v2_original)

        assert manifest_v2_result["schema_version"] == "2.0.0"
        assert manifest_v2_result["plugins"] == [{"plugin_id": "youtube-core", "enabled": True}]

    def test_upgrade_hybrid_project_no_plugins(self):
        """Hybrid project with no matching project types has empty plugins array."""
        manifest_v1 = {
            "project_type": "hybrid",
            "auto_include": True,
        }
        manifest_v2 = auto_upgrade_v1_to_v2(manifest_v1)

        assert manifest_v2["schema_version"] == "2.0.0"
        assert manifest_v2.get("plugins", []) == []


class TestManifestValidation:
    """Test validate_manifest() function."""

    def test_v1_manifest_valid(self):
        """V1 manifest with required fields is valid."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"
            manifest_path.write_text(json.dumps({
                "project_type": "youtube",
                "auto_include": True,
            }))

            result = validate_manifest(manifest_path)
            assert result.valid is True
            assert result.schema_version == "1.0.0"

    def test_v2_manifest_valid(self):
        """V2 manifest with schema_version is valid."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"
            manifest_path.write_text(json.dumps({
                "project_type": "code",
                "schema_version": "2.0.0",
                "plugins": [{"plugin_id": "code-mcp-tools", "enabled": True}],
            }))

            result = validate_manifest(manifest_path)
            assert result.valid is True
            assert result.schema_version == "2.0.0"

    def test_manifest_missing_project_type(self):
        """Manifest without project_type fails validation."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"
            manifest_path.write_text(json.dumps({
                "auto_include": True,
            }))

            result = validate_manifest(manifest_path)
            assert result.valid is False
            assert any("project_type" in e for e in result.errors)

    def test_manifest_invalid_project_type(self):
        """Manifest with invalid project_type fails validation."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"
            manifest_path.write_text(json.dumps({
                "project_type": "invalid_type",
            }))

            result = validate_manifest(manifest_path)
            assert result.valid is False
            assert any("Invalid project_type" in e for e in result.errors)

    def test_manifest_auto_include_not_boolean(self):
        """Manifest with non-boolean auto_include fails validation."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"
            manifest_path.write_text(json.dumps({
                "project_type": "code",
                "auto_include": "yes",
            }))

            result = validate_manifest(manifest_path)
            assert result.valid is False
            assert any("auto_include" in e and "boolean" in e for e in result.errors)

    def test_manifest_file_not_found(self):
        """Validation fails gracefully when manifest file doesn't exist."""
        result = validate_manifest(Path("/nonexistent/project.json"))
        assert result.valid is False
        assert any("not found" in e for e in result.errors)

    def test_manifest_invalid_json(self):
        """Validation fails gracefully for invalid JSON."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"
            manifest_path.write_text("{ invalid json }")

            result = validate_manifest(manifest_path)
            assert result.valid is False
            assert any("JSON" in e for e in result.errors)


class TestPluginValidation:
    """Test validate_plugins() function."""

    def test_plugins_valid_reference(self):
        """Valid plugin_id in manifest passes validation."""
        manifest = {
            "plugins": [
                {"plugin_id": "youtube-core", "enabled": True}
            ]
        }
        plugins_dir = Path(__file__).parent.parent / "optional_plugins"
        result = validate_plugins(manifest, plugins_dir)

        assert result.valid is True
        assert "youtube-core" in result.active_plugins

    def test_plugins_unknown_plugin_id(self):
        """Unknown plugin_id in manifest fails validation."""
        manifest = {
            "plugins": [
                {"plugin_id": "unknown-plugin", "enabled": True}
            ]
        }
        result = validate_plugins(manifest, Path("/fake/plugins"))

        assert result.valid is False
        assert any("unknown-plugin" in e for e in result.errors)

    def test_plugins_disabled_not_active(self):
        """Disabled plugins are not included in active_plugins."""
        manifest = {
            "plugins": [
                {"plugin_id": "youtube-core", "enabled": False}
            ]
        }
        result = validate_plugins(manifest, Path("/fake/plugins"))

        assert result.valid is True
        assert "youtube-core" not in result.active_plugins

    def test_plugins_missing_plugin_id(self):
        """Plugin reference without plugin_id fails validation."""
        manifest = {
            "plugins": [
                {"enabled": True}
            ]
        }
        result = validate_plugins(manifest, Path("/fake/plugins"))

        assert result.valid is False
        assert any("plugin_id" in e for e in result.errors)

    def test_plugins_not_array(self):
        """Non-array plugins field fails validation."""
        manifest = {
            "plugins": "youtube-core"
        }
        result = validate_plugins(manifest, Path("/fake/plugins"))

        assert result.valid is False
        assert any("array" in e for e in result.errors)

    def test_plugins_empty_array(self):
        """Empty plugins array is valid."""
        manifest = {
            "plugins": []
        }
        result = validate_plugins(manifest, Path("/fake/plugins"))

        assert result.valid is True
        assert result.active_plugins == []

    def test_plugins_multiple_valid(self):
        """Multiple valid plugins all activate."""
        manifest = {
            "plugins": [
                {"plugin_id": "youtube-core", "enabled": True},
                {"plugin_id": "geometry-rhino", "enabled": True},
                {"plugin_id": "code-mcp-tools", "enabled": True},
            ]
        }
        plugins_dir = Path(__file__).parent.parent / "optional_plugins"
        result = validate_plugins(manifest, plugins_dir)

        assert result.valid is True
        assert set(result.active_plugins) == {"youtube-core", "geometry-rhino", "code-mcp-tools"}


class TestManifestAnalysis:
    """Test analyze_manifest() function for V1 and V2."""

    def test_analysis_v1_basic(self):
        """V1 manifest analysis includes effective skills."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create minimal skills registry
            skills_dir = tmpdir / "skills"
            for skill in ["codebase-navigator", "systematic-debugging", "python-mcp"]:
                (skills_dir / skill).mkdir(parents=True)
                (skills_dir / skill / "SKILL.md").touch()

            manifest_path.write_text(json.dumps({
                "project_type": "code",
                "auto_include": False,
                "active_skills": ["python-mcp"],
            }))

            result = analyze_manifest(manifest_path, skills_dir)
            assert "python-mcp" in result.effective_skills

    def test_analysis_v2_includes_plugin_skills(self):
        """V2 manifest analysis includes skills from active plugins."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create skills registry for youtube skills
            skills_dir = tmpdir / "skills"
            for skill in ["codebase-navigator", "systematic-debugging", "youtube-strategy", "youtube-scriptwriting", "youtube-retention"]:
                (skills_dir / skill).mkdir(parents=True)
                (skills_dir / skill / "SKILL.md").touch()

            manifest_path.write_text(json.dumps({
                "project_type": "youtube",
                "schema_version": "2.0.0",
                "auto_include": True,
                "plugins": [{"plugin_id": "youtube-core", "enabled": True}],
            }))

            result = analyze_manifest(manifest_path, skills_dir)
            # Plugin skills should be in effective skills
            assert "youtube-strategy" in result.effective_skills
            assert "youtube-scriptwriting" in result.effective_skills
            assert "youtube-retention" in result.effective_skills
            assert result.active_plugins == ["youtube-core"]

    def test_analysis_disabled_plugins_not_included(self):
        """Disabled plugins don't add extra skills (default skills still loaded via auto_include)."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create skills registry
            skills_dir = tmpdir / "skills"
            for skill in ["codebase-navigator", "systematic-debugging", "youtube-strategy", "youtube-scriptwriting", "youtube-retention"]:
                (skills_dir / skill).mkdir(parents=True)
                (skills_dir / skill / "SKILL.md").touch()

            manifest_path.write_text(json.dumps({
                "project_type": "youtube",
                "schema_version": "2.0.0",
                "auto_include": True,
                "plugins": [{"plugin_id": "youtube-core", "enabled": False}],
            }))

            result = analyze_manifest(manifest_path, skills_dir)
            # Default youtube skills are still included via auto_include
            assert "youtube-strategy" in result.effective_skills
            # But the plugin is not marked as active
            assert not result.active_plugins


class TestBackwardCompatibility:
    """Test that V1 and V2 manifests coexist and work correctly."""

    def test_v1_manifest_still_works(self):
        """Existing V1 manifest validates without modification."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"

            # Realistic V1 manifest from existing project
            manifest_v1 = {
                "project_name": "Legacy Project",
                "project_type": "code",
                "auto_include": True,
                "active_skills": ["python-mcp"],
                "disabled_skills": ["youtube-strategy"],
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            result = validate_manifest(manifest_path)
            assert result.valid is True
            assert result.schema_version == "1.0.0"

    def test_v2_manifest_independent(self):
        """V2 manifests work independently of V1."""
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


class TestPluginRegistry:
    """Test PLUGIN_REGISTRY is properly defined."""

    def test_registry_completeness(self):
        """All 7 plugin categories are registered."""
        categories = {p["category"] for p in PLUGIN_REGISTRY.values()}
        assert categories == {"youtube", "pbi-report", "code-mcp", "geometry", "manuscript", "ms-office", "visual-storytelling"}

    def test_registry_skill_counts(self):
        """Plugin registry has correct skill assignments."""
        skills_by_plugin = {
            "youtube-core": 3,
            "ms-office-core": 3,
            "visual-storytelling-core": 2,
            "pbi-core": 1,
            "code-mcp-tools": 2,
            "geometry-rhino": 4,
            "manuscript-tools": 2,
        }
        for plugin_id, expected_count in skills_by_plugin.items():
            if plugin_id in PLUGIN_REGISTRY:
                actual = len(PLUGIN_REGISTRY[plugin_id]["skills"])
                assert actual == expected_count, f"{plugin_id} has {actual} skills, expected {expected_count}"


class TestV1toV2AutoUpgrade:
    """Test V1→V2 auto-upgrade on 3 representative project types."""

    def test_v1_youtube_project_auto_upgrade(self):
        """V1 youtube project auto-upgrades with youtube-core plugin."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create a realistic V1 youtube manifest
            manifest_v1 = {
                "project_name": "My YouTube Channel",
                "project_type": "youtube",
                "auto_include": True,
                "active_skills": ["banana-prompt"],
                "disabled_skills": [],
                "metadata": {"channel_id": "UC12345"},
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            # Validate and detect schema
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
            plugin_ids = [p["plugin_id"] for p in manifest_v2["plugins"]]
            assert "youtube-core" in plugin_ids

            # Verify V1 fields preserved
            assert manifest_v2["project_name"] == "My YouTube Channel"
            assert manifest_v2["project_type"] == "youtube"
            assert manifest_v2["auto_include"] is True
            assert manifest_v2["active_skills"] == ["banana-prompt"]
            assert manifest_v2["metadata"]["channel_id"] == "UC12345"

    def test_v1_code_project_auto_upgrade(self):
        """V1 code project auto-upgrades with code-mcp-tools plugin."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create a realistic V1 code manifest
            manifest_v1 = {
                "project_name": "Backend API",
                "project_type": "code",
                "auto_include": False,
                "active_skills": ["python-patterns", "systematic-debugging"],
                "disabled_skills": ["youtube-strategy"],
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            # Validate
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
            plugin_ids = [p["plugin_id"] for p in manifest_v2["plugins"]]
            assert "code-mcp-tools" in plugin_ids

            # Verify V1 fields preserved
            assert manifest_v2["project_type"] == "code"
            assert manifest_v2["auto_include"] is False
            assert manifest_v2["active_skills"] == ["python-patterns", "systematic-debugging"]
            assert manifest_v2["disabled_skills"] == ["youtube-strategy"]

    def test_v1_hybrid_project_auto_upgrade(self):
        """V1 hybrid project auto-upgrades with empty plugins array (no implicit plugins)."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create a V1 hybrid manifest
            manifest_v1 = {
                "project_name": "Multi-Domain Project",
                "project_type": "hybrid",
                "auto_include": True,
                "active_skills": ["python-patterns"],
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            # Validate
            result = validate_manifest(manifest_path)
            assert result.valid is True
            assert result.schema_version == "1.0.0"

            # Auto-upgrade
            with open(manifest_path) as f:
                manifest = json.load(f)
            manifest_v2 = auto_upgrade_v1_to_v2(manifest)

            # Verify V2 structure (hybrid has no default plugins)
            assert manifest_v2["schema_version"] == "2.0.0"
            assert "plugins" in manifest_v2
            assert manifest_v2["plugins"] == []  # Hybrid gets empty plugins array

            # Verify V1 fields preserved
            assert manifest_v2["project_type"] == "hybrid"
            assert manifest_v2["auto_include"] is True
            assert manifest_v2["active_skills"] == ["python-patterns"]

    def test_v1_manifest_all_fields_preserved_after_upgrade(self):
        """All V1 fields are preserved during auto-upgrade (no data loss)."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            manifest_path = tmpdir / "project.json"

            # Create a V1 manifest with many fields
            manifest_v1 = {
                "project_name": "Complex Project",
                "project_type": "geometry",
                "auto_include": True,
                "active_skills": ["cd-foundations"],
                "disabled_skills": ["youtube-retention"],
                "metadata": {
                    "owner": "test@example.com",
                    "custom_field": "custom_value",
                    "nested": {"key": "value"},
                },
                "tags": ["geometry", "rhino"],
            }
            manifest_path.write_text(json.dumps(manifest_v1))

            # Auto-upgrade
            with open(manifest_path) as f:
                manifest = json.load(f)
            manifest_v2 = auto_upgrade_v1_to_v2(manifest)

            # Verify all V1 fields are unchanged
            for key, value in manifest_v1.items():
                assert manifest_v2[key] == value, f"Field {key} was modified or lost"

            # Verify only new V2 fields were added
            assert manifest_v2["schema_version"] == "2.0.0"
            assert isinstance(manifest_v2["plugins"], list)

    def test_v1_to_v2_upgrade_silent_and_correct(self):
        """Auto-upgrade happens silently with no warnings or errors during normal validation."""
        with TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            project_root = tmpdir / "project"
            project_root.mkdir()
            manifest_path = project_root / "project.json"

            # Create 3 test projects (representative of real-world projects)
            test_cases = [
                ("youtube", {"project_type": "youtube", "auto_include": True}),
                ("code", {"project_type": "code", "auto_include": False, "active_skills": ["python-mcp"]}),
                ("geometry", {"project_type": "geometry", "auto_include": True}),
            ]

            for project_type, manifest_v1 in test_cases:
                manifest_path.write_text(json.dumps(manifest_v1))

                # Validate (should work for V1)
                result = validate_manifest(manifest_path)
                assert result.valid is True, f"V1 {project_type} project failed validation"
                assert result.schema_version == "1.0.0"

                # Auto-upgrade (should succeed silently)
                with open(manifest_path) as f:
                    manifest = json.load(f)
                manifest_v2 = auto_upgrade_v1_to_v2(manifest)

                # Verify upgrade
                assert manifest_v2["schema_version"] == "2.0.0"
                assert "plugins" in manifest_v2
                assert isinstance(manifest_v2["plugins"], list)

                # Verify that upgraded manifest also validates
                manifest_path.write_text(json.dumps(manifest_v2))
                result_v2 = validate_manifest(manifest_path)
                assert result_v2.valid is True, f"Upgraded {project_type} manifest failed validation"
                assert result_v2.schema_version == "2.0.0"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
