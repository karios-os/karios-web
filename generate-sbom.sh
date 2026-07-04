#!/bin/bash

OUTPUT_FILE="sbom-text-report.txt"

echo "KARIOS MICRO FRONTEND STARTER KIT - SOFTWARE BILL OF MATERIALS (SBOM)" > "$OUTPUT_FILE"
echo "======================================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "Format: Text Summary" >> "$OUTPUT_FILE"
echo "Source: package.json analysis" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Count total packages from package-lock.json
if [ -f "package-lock.json" ]; then
    TOTAL_PACKAGES=$(jq '.packages | length' package-lock.json)
else
    TOTAL_PACKAGES="N/A"
fi

echo "PACKAGE SUMMARY" >> "$OUTPUT_FILE"
echo "===============" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Total Packages: $TOTAL_PACKAGES" >> "$OUTPUT_FILE"
echo "Project: $(jq -r '.name' package.json)" >> "$OUTPUT_FILE"
echo "Version: $(jq -r '.version' package.json)" >> "$OUTPUT_FILE"
echo "License: $(jq -r '.license' package.json)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "PRODUCTION DEPENDENCIES" >> "$OUTPUT_FILE"
echo "=======================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
printf "%-45s %-15s\n" "Package Name" "Version" >> "$OUTPUT_FILE"
echo "=============================================================================" >> "$OUTPUT_FILE"

jq -r '.dependencies | to_entries[] | "\(.key)\t\(.value)"' package.json 2>/dev/null | while IFS=$'\t' read -r name version; do
    printf "%-45s %-15s\n" "$name" "$version" >> "$OUTPUT_FILE"
done

echo "" >> "$OUTPUT_FILE"
echo "DEV DEPENDENCIES" >> "$OUTPUT_FILE"
echo "================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
printf "%-45s %-15s\n" "Package Name" "Version" >> "$OUTPUT_FILE"
echo "=============================================================================" >> "$OUTPUT_FILE"

jq -r '.devDependencies | to_entries[] | "\(.key)\t\(.value)"' package.json 2>/dev/null | while IFS=$'\t' read -r name version; do
    printf "%-45s %-15s\n" "$name" "$version" >> "$OUTPUT_FILE"
done

echo "" >> "$OUTPUT_FILE"
echo "=============================================================================" >> "$OUTPUT_FILE"
echo "SBOM GENERATION COMPLETE" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Note: This SBOM includes direct dependencies from package.json." >> "$OUTPUT_FILE"
echo "For a complete list including transitive dependencies, see package-lock.json" >> "$OUTPUT_FILE"

