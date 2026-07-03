import pytest
import Rhino.Geometry as rg

def assert_is_closed(geometry, label="Geometry"):
    """Asserts that a Brep or Mesh is closed."""
    if isinstance(geometry, rg.Brep):
        assert geometry.IsSolid, f"{label} is not a closed Brep (Solid)."
    elif isinstance(geometry, rg.Mesh):
        assert geometry.IsClosed, f"{label} is not a closed Mesh."
    else:
        pytest.fail(f"{label} is neither a Brep nor a Mesh.")

def assert_is_manifold(mesh, label="Mesh"):
    """Asserts that a mesh is manifold and topologically sound."""
    assert isinstance(mesh, rg.Mesh), f"{label} must be a mesh."
    assert mesh.IsManifold(True), f"{label} is non-manifold."

def assert_near(pt_a, pt_b, tolerance=1e-6, label="Value Comparison"):
    """Asserts that two points or values are within tolerance using pytest.approx."""
    if hasattr(pt_a, "DistanceTo"):
        dist = pt_a.DistanceTo(pt_b)
        assert dist == pytest.approx(0.0, abs=tolerance), f"{label} failed: Distance {dist} > {tolerance}."
    else:
        assert pt_a == pytest.approx(pt_b, abs=tolerance), f"{label} failed: {pt_a} != {pt_b}"

def assert_intersection(geom_a, geom_b, expect_intersection=True, label="Intersection Check"):
    """Asserts that two geometries do (or do not) intersect."""
    # Simplified intersection check
    events = rg.Intersect.Intersection.BrepBrep(geom_a, geom_b, 0.001)
    has_intersection = len(events[1]) > 0 or len(events[2]) > 0
    
    if expect_intersection:
        assert has_intersection, f"{label} failed: Expected intersection but none found."
    else:
        assert not has_intersection, f"{label} failed: Unexpected intersection found."

def assert_volume_range(geometry, min_vol, max_vol, label="Volume Check"):
    """Asserts that the volume of a closed geometry is within a specific range."""
    # Ensure it's closed first
    assert_is_closed(geometry, label)
    
    if isinstance(geometry, rg.Brep):
        v_props = rg.VolumeMassProperties.Compute(geometry)
    else:
        v_props = rg.VolumeMassProperties.Compute(geometry) # Mesh also works
        
    vol = v_props.Volume
    assert min_vol <= vol <= max_vol, f"{label} failed: Volume {vol} outside range [{min_vol}, {max_vol}]."
