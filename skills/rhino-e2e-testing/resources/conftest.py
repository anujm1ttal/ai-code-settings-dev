import pytest
import rhinoinside
rhinoinside.load(8)

import Rhino # noqa: E402
import Rhino.Geometry as rg # noqa: E402

@pytest.fixture(scope="session")
def rhino():
    """Returns the Rhino namespace."""
    return Rhino

@pytest.fixture(scope="session")
def rg_module():
    """Returns the Rhino.Geometry namespace."""
    return rg

@pytest.fixture(scope="session")
def origin():
    """Returns a Point3d at 0,0,0."""
    return rg.Point3d(0, 0, 0)

@pytest.fixture(scope="session")
def xy_plane():
    """Returns the World XY plane."""
    return rg.Plane.WorldXY

@pytest.fixture(scope="session")
def sample_brep():
    """Returns a 10x10x5 Brep box."""
    box = rg.Box(
        rg.Plane.WorldXY,
        rg.Interval(0, 10),
        rg.Interval(0, 10),
        rg.Interval(0, 5),
    )
    return rg.Brep.CreateFromBox(box)

@pytest.fixture(scope="session")
def sample_mesh():
    """Returns a simple quad mesh."""
    mesh = rg.Mesh()
    mesh.Vertices.Add(0, 0, 0)
    mesh.Vertices.Add(10, 0, 0)
    mesh.Vertices.Add(10, 10, 0)
    mesh.Vertices.Add(0, 10, 0)
    mesh.Faces.AddFace(0, 1, 2, 3)
    mesh.Normals.ComputeNormals()
    mesh.Compact()
    return mesh
