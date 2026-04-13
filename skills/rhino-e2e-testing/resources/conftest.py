import pytest
import sys
import os

# Optional: Add specific Rhino paths if not in standard locations
# sys.path.append(r"C:\Program Files\Rhino 8\System")

@pytest.fixture(scope="session", autouse=True)
def rhino_setup():
    """
    Initializes the Rhino.Inside environment for the entire test session.
    Loads Rhino 8 runtime and ensures RhinoCommon is importable.
    """
    try:
        import rhinoinside
        rhinoinside.load(8)
        
        # Now we can import Rhino-specific namespaces
        import Rhino
        import Grasshopper
        
        # Verify loading
        print(f"\n[Rhino-E2E] Runtime Loaded: {Rhino.RhinoApp.Version}")
        
    except Exception as e:
        print(f"\n[Rhino-E2E] FATAL ERROR: Could not load Rhino 8. {e}")
        pytest.exit("Aborting tests due to Rhino initialization failure.")
    
    yield
    
    # Optional: Perform any cleanup if necessary
    # Note: rhinoinside usually handles process teardown on exit.
