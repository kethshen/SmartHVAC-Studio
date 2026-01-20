import os
import sys

# Try to import from the installed package
try:
    from eplus import EPlusUtil
except ImportError:
    print("[SimRunner] Warning: 'energy-plus-utility' not installed. Simulation will fail if run.")
    EPlusUtil = None

class SimulationRunner:
    def __init__(self, output_dir="/content/eplus_out"):
        self.output_dir = output_dir
        if EPlusUtil:
            self.util = EPlusUtil(verbose=1, out_dir=output_dir)
        else:
            self.util = None

    def run_job(self, idf_path, epw_path, config=None):
        """
        Executes an EnergyPlus simulation for the given IDF/EPW.
        Returns paths to the key output files.
        """
        if not self.util:
            raise EnvironmentError("EPlusUtil is not available. Install 'energy-plus-utility' first.")

        print(f"[SimRunner] Starting Job: {idf_path}")
        
        # 1. Clean previous runs
        self.util.delete_out_dir()
        
        # 2. Set Model
        # TODO: Parse config to set EKF parameters if needed
        self.util.set_model(idf_path, epw_path)
        
        # 3. Ensure SQL Output (Verified from user's notebook)
        self.util.ensure_output_sqlite()
        
        # 4. Run Simulation
        # Using run_simulation which is the standard entry point
        # Note: If EKF is enabled, we would attach hooks here before running
        print("[SimRunner] Executing EnergyPlus...")
        self.util.run_simulation()
        
        # 5. Check Results
        sql_path = os.path.join(self.output_dir, "eplusout.sql")
        if not os.path.exists(sql_path):
            raise FileNotFoundError("Simulation finished but 'eplusout.sql' was not created.")
            
        print("[SimRunner] Simulation Complete.")
        
        # Return dict of relevant files
        return {
            "sql": sql_path,
            # "csv": os.path.join(self.output_dir, "eplusout.csv") # If CSV generation is on
        }
