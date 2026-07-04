#!/bin/bash

OUTPUT_FILE="sbom-text-report.txt"

echo "KARIOS MICRO FRONTEND STARTER KIT - SOFTWARE BILL OF MATERIALS (SBOM)" > "$OUTPUT_FILE"
echo "======================================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "Format: Text Summary" >> "$OUTPUT_FILE"
echo "Source: package-lock.json (all dependencies)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Count total packages
TOTAL_PACKAGES=$(jq '.packages | length' package-lock.json)

echo "PACKAGE SUMMARY" >> "$OUTPUT_FILE"
echo "===============" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Total Packages: $TOTAL_PACKAGES" >> "$OUTPUT_FILE"
echo "Project: $(jq -r '.name' package.json)" >> "$OUTPUT_FILE"
echo "Version: $(jq -r '.version' package.json)" >> "$OUTPUT_FILE"
echo "License: $(jq -r '.license' package.json)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "ALL DEPENDENCIES (INCLUDING TRANSITIVE)" >> "$OUTPUT_FILE"
echo "========================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
printf "%-50s %-20s %-15s\n" "Package Name" "Version" "License" >> "$OUTPUT_FILE"
echo "======================================================================================" >> "$OUTPUT_FILE"

# Extract all packages from package-lock.json with better formatting
jq -r '.packages | to_entries[] | select(.key != "") | "\(.key)\t\(.value.version // "N/A")\t\(.value.license // "NOASSERTION")"' package-lock.json | \
sed 's|node_modules/||g' | sed 's|.*/node_modules/||g' | sort -u | while IFS=$'\t' read -r name version license; do
    if [ ! -z "$name" ]; then
        printf "%-50s %-20s %-15s\n" "$name" "$version" "$license" >> "$OUTPUT_FILE"
    fi
done

echo "" >> "$OUTPUT_FILE"
echo "======================================================================================" >> "$OUTPUT_FILE"
echo "SBOM GENERATION COMPLETE" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "This SBOM includes all $TOTAL_PACKAGES packages from the dependency tree." >> "$OUTPUT_FILE"

