#!/usr/bin/env python3
import argparse
import os
import sys

def main():
    parser = argparse.ArgumentParser(
        description="Verify the existence of evidence files and search for specific patterns.",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("path", help="Path to the file or directory to check.")
    parser.add_argument("--pattern", help="Optional text pattern to search for in the file(s).")
    parser.add_argument("--require-empty", action="store_true", help="Ensure the directory or file is empty (e.g. for cleanup verification).")
    
    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)
        
    args = parser.parse_args()
    
    if not os.path.exists(args.path):
        print(f"FAILED: Path does not exist: {args.path}")
        sys.exit(1)
        
    if args.require_empty:
        if os.path.isdir(args.path):
            items = os.listdir(args.path)
            if items:
                print(f"FAILED: Directory is not empty. Found: {items}")
                sys.exit(1)
        elif os.path.getsize(args.path) > 0:
            print(f"FAILED: File is not empty.")
            sys.exit(1)
        print(f"PASSED: {args.path} is empty.")
        sys.exit(0)

    if args.pattern:
        found = False
        if os.path.isfile(args.path):
            with open(args.path, 'r', encoding='utf-8', errors='ignore') as f:
                if args.pattern in f.read():
                    found = True
        elif os.path.isdir(args.path):
            for root, _, files in os.walk(args.path):
                for name in files:
                    with open(os.path.join(root, name), 'r', encoding='utf-8', errors='ignore') as f:
                        if args.pattern in f.read():
                            found = True
                            break
                if found: break
        
        if found:
            print(f"PASSED: Found pattern '{args.pattern}' in {args.path}")
            sys.exit(0)
        else:
            print(f"FAILED: Pattern '{args.pattern}' not found in {args.path}")
            sys.exit(1)

    print(f"PASSED: {args.path} exists.")
    sys.exit(0)

if __name__ == "__main__":
    main()
