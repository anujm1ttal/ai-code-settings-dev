import os
import Grasshopper as gh
import Rhino.Geometry as rg

class GHHeadlessRunner:
    """
    Utilities for executing Grasshopper definitions headlessly.
    """
    
    def __init__(self, file_path):
        if not os.path.isabs(file_path):
            raise ValueError(f"File path must be absolute: {file_path}")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"GH file not found: {file_path}")
            
        self.io = gh.Kernel.GH_DocumentIO()
        if not self.io.Open(file_path):
            raise Exception(f"Failed to open GH file: {file_path}")
            
        self.doc = self.io.Document
        
    def set_input(self, name, value):
        """
        Finishes a parameter by name and sets its persistent data.
        Supports simple types (numbers, strings).
        """
        param = self.doc.FindParameter(name)
        if param is None:
            # Try finding by component nickname if parameter name fails
            for obj in self.doc.Objects:
                if obj.NickName == name:
                    param = obj
                    break
        
        if param is None:
            raise ValueError(f"Could not find parameter or component named '{name}'")
            
        param.PersistentData.Clear()
        
        # Wrap value in GH types
        if isinstance(value, (int, float)):
            from Grasshopper.Kernel.Types import GH_Number
            param.PersistentData.Append(GH_Number(float(value)))
        elif isinstance(value, str):
            from Grasshopper.Kernel.Types import GH_String
            param.PersistentData.Append(GH_String(value))
        # Add more types as needed (Points, Vectors, etc.)
        
    def solve(self):
        """Triggers a solution in the Grasshopper document."""
        self.doc.NewSolution(True)
        
    def get_output(self, name):
        """Retrieves data from an output parameter."""
        param = self.doc.FindParameter(name)
        if param is None:
            raise ValueError(f"Could not find output parameter named '{name}'")
            
        # Get volatile data (result of calculation)
        data_tree = param.VolatileData
        results = []
        
        for i in range(data_tree.PathCount):
            branch = data_tree.get_Branch(i)
            for item in branch:
                if item is not None:
                    # Unwrap from GH type to RhinoCommon type
                    results.append(item.Value)
                    
        return results

    def close(self):
        """Closes the document and releases resources."""
        self.doc.Enabled = False
        gh.Instances.DocumentServer.RemoveDocument(self.doc)
