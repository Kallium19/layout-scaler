/**
 * Layout Scaler Webapp - Pure JS Logic & DOM Handler
 */

// Standard Drafting Scales (1:N)
const STANDARD_SCALES = [1, 2, 5, 10, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000];

// State
let objectCounter = 0;
let objectsList = [];
let currentCalculationResult = null;

// Pure Math Functions (Step 1 to Step 5)

/**
 * Step 1: Compute Layout Space
 */
function computeLayoutSpace(drawableArea, annotationSpace) {
  const length = drawableArea.length - annotationSpace.length;
  const width = drawableArea.width - annotationSpace.width;
  if (length <= 0 || width <= 0) {
    throw new Error("Annotation Space is larger than or equal to Drawable Area. Reduce your margins or annotation space.");
  }
  return { length, width };
}

/**
 * Step 2: Compute Candidate Ratios (Orientation A vs B)
 */
function computeCandidateScales(layoutSpace, referenceSize, allowRotation = true) {
  if (referenceSize.length <= 0 || referenceSize.width <= 0) {
    throw new Error("Reference Size must be positive numbers greater than 0.");
  }

  // Orientation A (given)
  const ratioA_length = layoutSpace.length / referenceSize.length;
  const ratioA_width = layoutSpace.width / referenceSize.width;
  const scaleA = Math.min(ratioA_length, ratioA_width);

  // Orientation B (rotated 90°)
  const ratioB_length = layoutSpace.length / referenceSize.width;
  const ratioB_width = layoutSpace.width / referenceSize.length;
  const scaleB = Math.min(ratioB_length, ratioB_width);

  let chosenOrientation = "A";
  let rawScaleFactor = scaleA;

  if (allowRotation && scaleB > scaleA) {
    chosenOrientation = "B";
    rawScaleFactor = scaleB;
  }

  return { scaleA, scaleB, chosenOrientation, rawScaleFactor };
}

/**
 * Step 3: Snap raw scale factor to nearest standard drafting scale
 */
function snapToStandardScale(rawScaleFactor) {
  if (rawScaleFactor <= 0) return { snappedN: 1000, snappedScaleFactor: 1 / 1000 };
  
  const rawN = 1 / rawScaleFactor;
  let snappedN = STANDARD_SCALES.find(n => n >= rawN);
  
  // Fallback if rawN is larger than maximum predefined scale
  if (!snappedN) {
    snappedN = Math.ceil(rawN);
  }
  
  const snappedScaleFactor = 1 / snappedN;
  return { rawN, snappedN, snappedScaleFactor };
}

/**
 * Step 5: Compute Centering Offset
 */
function computeCenteringOffset(layoutSpace, referenceSize, chosenOrientation, activeScaleFactor) {
  const refLength = chosenOrientation === "B" ? referenceSize.width : referenceSize.length;
  const refWidth = chosenOrientation === "B" ? referenceSize.length : referenceSize.width;

  const scaledBoundingBox = {
    length: refLength * activeScaleFactor,
    width: refWidth * activeScaleFactor
  };

  const offsetX = (layoutSpace.length - scaledBoundingBox.length) / 2;
  const offsetY = (layoutSpace.width - scaledBoundingBox.width) / 2;

  return { offsetX, offsetY, scaledBoundingBox };
}

/**
 * Step 4: Scale an Individual Object
 */
function scaleObject(obj, activeScaleFactor, chosenOrientation, referenceSize, offset) {
  // Out of bounds check on unrotated reference size
  const extendsX = (obj.x + obj.length) > referenceSize.length;
  const extendsY = (obj.y + obj.width) > referenceSize.width;
  const isOutOfBounds = extendsX || extendsY;

  // Swap orientation if Orientation B
  let effLength = obj.length;
  let effWidth = obj.width;
  let effX = obj.x;
  let effY = obj.y;

  if (chosenOrientation === "B") {
    effLength = obj.width;
    effWidth = obj.length;
    effX = obj.y;
    effY = obj.x;
  }

  const finalLength = effLength * activeScaleFactor;
  const finalWidth = effWidth * activeScaleFactor;
  const finalX = (effX * activeScaleFactor) + offset.offsetX;
  const finalY = (effY * activeScaleFactor) + offset.offsetY;

  return {
    ...obj,
    finalLength,
    finalWidth,
    finalX,
    finalY,
    isOutOfBounds
  };
}

// DOM Event Handlers & Controllers

document.addEventListener("DOMContentLoaded", () => {
  // Element References
  const unitSelect = document.getElementById("unit-select");
  const unitLabels = document.querySelectorAll(".unit-label");

  const drawableLengthInput = document.getElementById("drawable-length");
  const drawableWidthInput = document.getElementById("drawable-width");
  const annotationLengthInput = document.getElementById("annotation-length");
  const annotationWidthInput = document.getElementById("annotation-width");
  const referenceLengthInput = document.getElementById("reference-length");
  const referenceWidthInput = document.getElementById("reference-width");

  const allowRotationCheckbox = document.getElementById("allow-rotation");
  const useStandardScaleCheckbox = document.getElementById("use-standard-scale");

  const calculateBtn = document.getElementById("calculate-btn");
  const errorMessageDiv = document.getElementById("error-message");
  const resultsPanel = document.getElementById("results-panel");

  const resLayoutSpace = document.getElementById("res-layout-space");
  const resOrientation = document.getElementById("res-orientation");
  const resRawScale = document.getElementById("res-raw-scale");
  const resStandardScale = document.getElementById("res-standard-scale");
  const resActiveScale = document.getElementById("res-active-scale");
  const resCenteringOffset = document.getElementById("res-centering-offset");

  const addObjectBtn = document.getElementById("add-object-btn");
  const objectsTbody = document.getElementById("objects-tbody");

  const exportCsvBtn = document.getElementById("export-csv-btn");
  const exportJsonBtn = document.getElementById("export-json-btn");

  // Initial setup: Add 2 sample objects
  addObjectRow("Table A", 1200, 800, 500, 500);
  addObjectRow("Wall Unit B", 2000, 400, 2000, 1000);

  // Unit Selector Change
  unitSelect.addEventListener("change", () => {
    const selectedUnit = unitSelect.value;
    unitLabels.forEach(label => {
      label.textContent = selectedUnit;
    });
  });

  // Calculate Button Trigger
  calculateBtn.addEventListener("click", () => {
    runCalculation();
  });

  // Checkbox live recompute
  allowRotationCheckbox.addEventListener("change", () => {
    if (!resultsPanel.classList.contains("hidden")) {
      runCalculation();
    }
  });

  useStandardScaleCheckbox.addEventListener("change", () => {
    if (!resultsPanel.classList.contains("hidden")) {
      runCalculation();
    }
  });

  // Add Object Row Button
  addObjectBtn.addEventListener("click", () => {
    addObjectRow();
  });

  // Export CSV
  exportCsvBtn.addEventListener("click", () => {
    exportCSV();
  });

  // Export JSON
  exportJsonBtn.addEventListener("click", () => {
    exportJSON();
  });

  /**
   * Primary Calculation Function
   */
  function runCalculation() {
    clearError();

    // Parse Numeric Inputs
    const drawableArea = {
      length: parseFloat(drawableLengthInput.value),
      width: parseFloat(drawableWidthInput.value)
    };

    const annotationSpace = {
      length: parseFloat(annotationLengthInput.value),
      width: parseFloat(annotationWidthInput.value)
    };

    const referenceSize = {
      length: parseFloat(referenceLengthInput.value),
      width: parseFloat(referenceWidthInput.value)
    };

    // Validation
    if (isNaN(drawableArea.length) || drawableArea.length <= 0 ||
        isNaN(drawableArea.width) || drawableArea.width <= 0) {
      showError("Drawable Area dimensions must be positive numbers.");
      return;
    }

    if (isNaN(annotationSpace.length) || annotationSpace.length < 0 ||
        isNaN(annotationSpace.width) || annotationSpace.width < 0) {
      showError("Annotation Space dimensions must be non-negative numbers.");
      return;
    }

    if (isNaN(referenceSize.length) || referenceSize.length <= 0 ||
        isNaN(referenceSize.width) || referenceSize.width <= 0) {
      showError("Reference Size dimensions must be positive numbers greater than zero.");
      return;
    }

    try {
      // Step 1: Layout Space
      const layoutSpace = computeLayoutSpace(drawableArea, annotationSpace);

      // Step 2: Orientation & Raw Scale
      const allowRotation = allowRotationCheckbox.checked;
      const { chosenOrientation, rawScaleFactor } = computeCandidateScales(layoutSpace, referenceSize, allowRotation);

      // Step 3: Standard Scale Snapping
      const { rawN, snappedN, snappedScaleFactor } = snapToStandardScale(rawScaleFactor);

      // Select active scale factor
      const useStandard = useStandardScaleCheckbox.checked;
      const activeScaleFactor = useStandard ? snappedScaleFactor : rawScaleFactor;

      // Step 5: Centering Offset
      const offset = computeCenteringOffset(layoutSpace, referenceSize, chosenOrientation, activeScaleFactor);

      // Save Calculation State
      currentCalculationResult = {
        layoutSpace,
        chosenOrientation,
        rawN,
        snappedN,
        activeScaleFactor,
        offset,
        referenceSize
      };

      // Render Results Panel
      resLayoutSpace.textContent = `${layoutSpace.length.toFixed(2)} × ${layoutSpace.width.toFixed(2)} ${unitSelect.value}`;
      resOrientation.textContent = chosenOrientation === "B" ? "Rotated 90° (Swapped Axes)" : "Original (0°)";
      resRawScale.textContent = `1 : ${rawN.toFixed(2)}`;
      resStandardScale.textContent = `1 : ${snappedN}`;
      resActiveScale.textContent = `${activeScaleFactor.toFixed(6)} (1:${(1 / activeScaleFactor).toFixed(2)})`;
      resCenteringOffset.textContent = `X: ${offset.offsetX.toFixed(2)}, Y: ${offset.offsetY.toFixed(2)} ${unitSelect.value}`;

      resultsPanel.classList.remove("hidden");

      // Recompute Objects Table
      updateObjectsTable();

    } catch (err) {
      showError(err.message);
      resultsPanel.classList.add("hidden");
    }
  }

  /**
   * Render/Update Objects Table
   */
  function updateObjectsTable() {
    const rows = objectsTbody.querySelectorAll("tr");
    objectsList = [];

    rows.forEach((row, index) => {
      const id = row.getAttribute("data-id");
      const nameInput = row.querySelector(".obj-name");
      const lenInput = row.querySelector(".obj-len");
      const widInput = row.querySelector(".obj-wid");
      const xInput = row.querySelector(".obj-x");
      const yInput = row.querySelector(".obj-y");

      const resLenCell = row.querySelector(".res-len");
      const resWidCell = row.querySelector(".res-wid");
      const resXCell = row.querySelector(".res-x");
      const resYCell = row.querySelector(".res-y");
      const statusCell = row.querySelector(".res-status");

      const name = nameInput.value.trim() || `Object ${index + 1}`;
      const length = parseFloat(lenInput.value) || 0;
      const width = parseFloat(widInput.value) || 0;
      const x = parseFloat(xInput.value) || 0;
      const y = parseFloat(yInput.value) || 0;

      const rawObj = { id, name, length, width, x, y };

      if (currentCalculationResult) {
        const scaledObj = scaleObject(
          rawObj,
          currentCalculationResult.activeScaleFactor,
          currentCalculationResult.chosenOrientation,
          currentCalculationResult.referenceSize,
          currentCalculationResult.offset
        );

        resLenCell.textContent = scaledObj.finalLength.toFixed(2);
        resWidCell.textContent = scaledObj.finalWidth.toFixed(2);
        resXCell.textContent = scaledObj.finalX.toFixed(2);
        resYCell.textContent = scaledObj.finalY.toFixed(2);

        if (scaledObj.isOutOfBounds) {
          statusCell.innerHTML = `<span class="status-warn">⚠️ Extends outside ref bounds</span>`;
        } else {
          statusCell.innerHTML = `<span class="status-ok">✓ Fit</span>`;
        }

        objectsList.push(scaledObj);
      } else {
        resLenCell.textContent = "-";
        resWidCell.textContent = "-";
        resXCell.textContent = "-";
        resYCell.textContent = "-";
        statusCell.textContent = "-";
        objectsList.push(rawObj);
      }
    });
  }

  /**
   * Add a new object row to table
   */
  function addObjectRow(name = "", len = 1000, wid = 500, x = 0, y = 0) {
    objectCounter++;
    const rowId = `obj_${objectCounter}`;
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", rowId);

    tr.innerHTML = `
      <td>${objectsTbody.children.length + 1}</td>
      <td><input type="text" class="form-control table-input obj-name" value="${name || 'Object ' + objectCounter}"></td>
      <td><input type="number" class="form-control table-input obj-len" step="any" value="${len}"></td>
      <td><input type="number" class="form-control table-input obj-wid" step="any" value="${wid}"></td>
      <td><input type="number" class="form-control table-input obj-x" step="any" value="${x}"></td>
      <td><input type="number" class="form-control table-input obj-y" step="any" value="${y}"></td>
      <td class="res-len">-</td>
      <td class="res-wid">-</td>
      <td class="res-x">-</td>
      <td class="res-y">-</td>
      <td class="res-status">-</td>
      <td><button class="btn btn-danger remove-btn">Delete</button></td>
    `;

    // Attach listeners for dynamic update
    const inputs = tr.querySelectorAll("input");
    inputs.forEach(input => {
      input.addEventListener("input", () => {
        if (currentCalculationResult) {
          updateObjectsTable();
        }
      });
    });

    const removeBtn = tr.querySelector(".remove-btn");
    removeBtn.addEventListener("click", () => {
      tr.remove();
      renumberRows();
      if (currentCalculationResult) {
        updateObjectsTable();
      }
    });

    objectsTbody.appendChild(tr);

    if (currentCalculationResult) {
      updateObjectsTable();
    }
  }

  function renumberRows() {
    const rows = objectsTbody.querySelectorAll("tr");
    rows.forEach((row, idx) => {
      row.children[0].textContent = idx + 1;
    });
  }

  function showError(msg) {
    errorMessageDiv.textContent = msg;
    errorMessageDiv.classList.remove("hidden");
  }

  function clearError() {
    errorMessageDiv.textContent = "";
    errorMessageDiv.classList.add("hidden");
  }

  // Export CSV Function
  function exportCSV() {
    if (objectsList.length === 0) {
      alert("No object data available to export.");
      return;
    }

    const unit = unitSelect.value;
    const headers = [
      "Name",
      `Real Length (${unit})`,
      `Real Width (${unit})`,
      `Real X (${unit})`,
      `Real Y (${unit})`,
      `Final Length (${unit})`,
      `Final Width (${unit})`,
      `Final X (${unit})`,
      `Final Y (${unit})`,
      "Warning"
    ];

    const rows = objectsList.map(obj => [
      `"${obj.name.replace(/"/g, '""')}"`,
      obj.length,
      obj.width,
      obj.x,
      obj.y,
      obj.finalLength ? obj.finalLength.toFixed(2) : "-",
      obj.finalWidth ? obj.finalWidth.toFixed(2) : "-",
      obj.finalX ? obj.finalX.toFixed(2) : "-",
      obj.finalY ? obj.finalY.toFixed(2) : "-",
      obj.isOutOfBounds ? "Extends outside ref bounds" : "None"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadFile(csvContent, "layout_scaler_objects.csv", "text/csv;charset=utf-8;");
  }

  // Export JSON Function
  function exportJSON() {
    if (objectsList.length === 0) {
      alert("No object data available to export.");
      return;
    }

    const payload = {
      unit: unitSelect.value,
      calculationResult: currentCalculationResult,
      objects: objectsList
    };

    const jsonContent = JSON.stringify(payload, null, 2);
    downloadFile(jsonContent, "layout_scaler_export.json", "application/json");
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Run initial calculation on page load
  runCalculation();
});
