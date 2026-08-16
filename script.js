/**
 * Layout Scaler Webapp - Pure JS Logic & DOM Handler
 */

// Standard Drafting Scales (1:N)
const STANDARD_SCALES = [1, 2, 5, 10, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000];

// Conversion factors relative to 1 Meter
const UNIT_TO_METERS = {
  m: 1.0,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048
};

/**
 * Convert value between any two supported length units
 */
function convertValue(val, fromUnit, toUnit) {
  if (fromUnit === toUnit) return val;
  const valInMeters = val * UNIT_TO_METERS[fromUnit];
  return valInMeters / UNIT_TO_METERS[toUnit];
}

// State
let objectCounter = 0;
let objectsList = [];
let currentCalculationResult = null;

// Pure Math Functions

/**
 * Step 1: Compute Layout Space (in renderUnit)
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
 * Converted to unified renderUnit before ratio calculation
 */
function computeCandidateScales(layoutSpace, referenceSize, referenceUnit, renderUnit, allowRotation = true) {
  if (referenceSize.length <= 0 || referenceSize.width <= 0) {
    throw new Error("Reference Size must be positive numbers greater than 0.");
  }

  // Convert reference size to renderUnit for unitless ratio comparison
  const refLenRender = convertValue(referenceSize.length, referenceUnit, renderUnit);
  const refWidRender = convertValue(referenceSize.width, referenceUnit, renderUnit);

  // Orientation A (given)
  const ratioA_length = layoutSpace.length / refLenRender;
  const ratioA_width = layoutSpace.width / refWidRender;
  const scaleA = Math.min(ratioA_length, ratioA_width);

  // Orientation B (rotated 90°)
  const ratioB_length = layoutSpace.length / refWidRender;
  const ratioB_width = layoutSpace.width / refLenRender;
  const scaleB = Math.min(ratioB_length, ratioB_width);

  let chosenOrientation = "A";
  let rawScaleFactor = scaleA;

  if (allowRotation && scaleB > scaleA) {
    chosenOrientation = "B";
    rawScaleFactor = scaleB;
  }

  return { scaleA, scaleB, chosenOrientation, rawScaleFactor, refLenRender, refWidRender };
}

/**
 * Step 3: Snap raw scale factor to nearest standard drafting scale (1:N)
 */
function snapToStandardScale(rawScaleFactor) {
  if (rawScaleFactor <= 0) return { rawN: 1000, snappedN: 1000, snappedScaleFactor: 1 / 1000 };
  
  const rawN = 1 / rawScaleFactor;
  let snappedN = STANDARD_SCALES.find(n => n >= rawN);
  
  if (!snappedN) {
    snappedN = Math.ceil(rawN);
  }
  
  const snappedScaleFactor = 1 / snappedN;
  return { rawN, snappedN, snappedScaleFactor };
}

/**
 * Step 5: Compute Centering Offset (in renderUnit)
 */
function computeCenteringOffset(layoutSpace, refLenRender, refWidRender, chosenOrientation, activeScaleFactor) {
  const refLength = chosenOrientation === "B" ? refWidRender : refLenRender;
  const refWidth = chosenOrientation === "B" ? refLenRender : refWidRender;

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
function scaleObject(obj, referenceUnit, renderUnit, activeScaleFactor, chosenOrientation, referenceSize, offset) {
  // Out of bounds check on unrotated reference size in real reference units
  const extendsX = (obj.x + obj.length) > referenceSize.length;
  const extendsY = (obj.y + obj.width) > referenceSize.width;
  const isOutOfBounds = extendsX || extendsY;

  // Convert raw object size & position from referenceUnit to renderUnit
  const objLenRender = convertValue(obj.length, referenceUnit, renderUnit);
  const objWidRender = convertValue(obj.width, referenceUnit, renderUnit);
  const objXRender = convertValue(obj.x, referenceUnit, renderUnit);
  const objYRender = convertValue(obj.y, referenceUnit, renderUnit);

  // Swap axes if Orientation B
  let effLength = objLenRender;
  let effWidth = objWidRender;
  let effX = objXRender;
  let effY = objYRender;

  if (chosenOrientation === "B") {
    effLength = objWidRender;
    effWidth = objLenRender;
    effX = objYRender;
    effY = objXRender;
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
  // Unit Selectors
  const refUnitSelect = document.getElementById("reference-unit-select");
  const renderUnitSelect = document.getElementById("render-unit-select");

  const refUnitLabels = document.querySelectorAll(".ref-unit-label");
  const renderUnitLabels = document.querySelectorAll(".render-unit-label");

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

  // Initial Sample Objects (in meters)
  addObjectRow("Desk Table A", 1.2, 0.8, 0.5, 0.5);
  addObjectRow("Storage Unit B", 2.0, 0.4, 2.0, 1.0);

  // Update Unit Labels
  function updateUnitLabels() {
    const refUnit = refUnitSelect.value;
    const renderUnit = renderUnitSelect.value;

    refUnitLabels.forEach(label => label.textContent = refUnit);
    renderUnitLabels.forEach(label => label.textContent = renderUnit);
  }

  refUnitSelect.addEventListener("change", () => {
    updateUnitLabels();
    if (!resultsPanel.classList.contains("hidden")) {
      runCalculation();
    }
  });

  renderUnitSelect.addEventListener("change", () => {
    updateUnitLabels();
    if (!resultsPanel.classList.contains("hidden")) {
      runCalculation();
    }
  });

  // Calculate Trigger
  calculateBtn.addEventListener("click", () => {
    runCalculation();
  });

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

  addObjectBtn.addEventListener("click", () => {
    addObjectRow();
  });

  exportCsvBtn.addEventListener("click", () => {
    exportCSV();
  });

  exportJsonBtn.addEventListener("click", () => {
    exportJSON();
  });

  /**
   * Primary Calculation Function
   */
  function runCalculation() {
    clearError();

    const refUnit = refUnitSelect.value;
    const renderUnit = renderUnitSelect.value;

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

    // Input Validation
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
      // Step 1: Layout Space in renderUnit
      const layoutSpace = computeLayoutSpace(drawableArea, annotationSpace);

      // Step 2: Orientation & Raw Scale (with unit conversion)
      const allowRotation = allowRotationCheckbox.checked;
      const { chosenOrientation, rawScaleFactor, refLenRender, refWidRender } = computeCandidateScales(
        layoutSpace,
        referenceSize,
        refUnit,
        renderUnit,
        allowRotation
      );

      // Step 3: Standard Scale Snapping
      const { rawN, snappedN, snappedScaleFactor } = snapToStandardScale(rawScaleFactor);

      const useStandard = useStandardScaleCheckbox.checked;
      const activeScaleFactor = useStandard ? snappedScaleFactor : rawScaleFactor;

      // Step 5: Centering Offset in renderUnit
      const offset = computeCenteringOffset(
        layoutSpace,
        refLenRender,
        refWidRender,
        chosenOrientation,
        activeScaleFactor
      );

      // Save Calculation State
      currentCalculationResult = {
        refUnit,
        renderUnit,
        layoutSpace,
        chosenOrientation,
        rawN,
        snappedN,
        activeScaleFactor,
        offset,
        referenceSize
      };

      // Render Results Panel
      resLayoutSpace.textContent = `${layoutSpace.length.toFixed(2)} × ${layoutSpace.width.toFixed(2)} ${renderUnit}`;
      resOrientation.textContent = chosenOrientation === "B" ? "Rotated 90° (Swapped Axes)" : "Original (0°)";
      resRawScale.textContent = `1 : ${rawN.toFixed(2)}`;
      resStandardScale.textContent = `1 : ${snappedN}`;
      resActiveScale.textContent = `${activeScaleFactor.toFixed(6)} (1:${(1 / activeScaleFactor).toFixed(2)})`;
      resCenteringOffset.textContent = `X: ${offset.offsetX.toFixed(2)}, Y: ${offset.offsetY.toFixed(2)} ${renderUnit}`;

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
          currentCalculationResult.refUnit,
          currentCalculationResult.renderUnit,
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
  function addObjectRow(name = "", len = 1.0, wid = 0.5, x = 0, y = 0) {
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

  function exportCSV() {
    if (objectsList.length === 0) {
      alert("No object data available to export.");
      return;
    }

    const refUnit = refUnitSelect.value;
    const renderUnit = renderUnitSelect.value;

    const headers = [
      "Name",
      `Real Length (${refUnit})`,
      `Real Width (${refUnit})`,
      `Real X (${refUnit})`,
      `Real Y (${refUnit})`,
      `Final Length (${renderUnit})`,
      `Final Width (${renderUnit})`,
      `Final X (${renderUnit})`,
      `Final Y (${renderUnit})`,
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

  function exportJSON() {
    if (objectsList.length === 0) {
      alert("No object data available to export.");
      return;
    }

    const payload = {
      referenceUnit: refUnitSelect.value,
      renderUnit: renderUnitSelect.value,
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

  // Initial Calculation Run
  updateUnitLabels();
  runCalculation();
});
