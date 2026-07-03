#!/usr/bin/env python3
import argparse
import sys
import subprocess

def main():
    parser = argparse.ArgumentParser(
        description="Standardized runner for Rhino.Inside headless tests using pytest.",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("path", nargs="?", default="tests/e2e", help="Path to the test directory or file (default: tests/e2e).")
    parser.add_argument("--cov", help="Enable coverage for specific module (e.g. --cov=src).")
    parser.add_argument("--markers", action="store_true", help="List available markers.")
    parser.add_argument("--verbose", "-v", action="store_true", help="Increase verbosity.")
    
    args, unknown = parser.parse_known_args()
    
    if args.markers:
        subprocess.run(["pytest", "--markers"])
        sys.exit(0)
        
    cmd = ["pytest", args.path]
    if args.cov:
        cmd.extend([f"--cov={args.cov}", "--cov-report=term-missing"])
    if args.verbose:
        cmd.append("-v")
    
    # Append any unknown arguments to pytest
    cmd.extend(unknown)
    
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
