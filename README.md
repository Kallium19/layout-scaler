# Layout Scaler Webapp

A web application designed for students and architects to convert real-world architectural dimensions and furniture layouts into scaled, render-ready drafting dimensions and coordinates.

## Features

- **Dual-Unit System**:
  - **Real-World Reference Unit** (`m`, `cm`, `mm`, `ft`, `in`) for room layouts and real furniture dimensions.
  - **Sheet / Render Unit** (`mm`, `cm`, `in`, `m`, `ft`) for sheet size, margins, and final rendered paper dimensions.
  - *Example*: Room specified in meters ($10\text{ m} \times 5\text{ m}$) rendered onto a sheet specified in millimeters ($420\text{ mm} \times 297\text{ mm}$) or centimeters.
- **Layout Space & Margin Check**: Computes usable drafting area by subtracting Annotation Space (margins/labels) from total Drawable Area.
- **Orientation Fitting (0° vs 90°)**: Tests layout orientation choices to automatically pick the orientation that maximizes usable sheet scale factor.
- **Standard Drafting Scale Snapping**: Converts raw scale factors into standard drafting scales ($1:N \in [1, 2, 5, 10, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000]$).
- **Scaled Object Coordinates & Centering**: Automatically calculates scaled object sizes and positions with centering offsets in the target render unit.
- **Validation & Out-of-Bounds Flagging**: Validates numeric inputs and flags any object extending past reference layout boundaries.
- **CSV & JSON Data Export**: Download the scaled object table as a `.csv` or `.json` file for drafting reference.

---

## Math & Unit Conversion Specs

1. **Unit Conversion**:
   All reference values are converted to the target sheet render unit using physical length conversion factors before ratio calculations.

2. **Layout Space**:
   $$\text{LayoutSpace}_{\text{Length}} = \text{DrawableArea}_{\text{Length}} - \text{AnnotationSpace}_{\text{Length}}$$
   $$\text{LayoutSpace}_{\text{Width}} = \text{DrawableArea}_{\text{Width}} - \text{AnnotationSpace}_{\text{Width}}$$

3. **Candidate Scale Factor**:
   - **Orientation A (0°)**:
     $$\text{Scale}_A = \min\left(\frac{\text{LayoutSpace}_{\text{Length}}}{\text{RefLength}_{\text{render}}}, \frac{\text{LayoutSpace}_{\text{Width}}}{\text{RefWidth}_{\text{render}}}\right)$$
   - **Orientation B (90°)**:
     $$\text{Scale}_B = \min\left(\frac{\text{LayoutSpace}_{\text{Length}}}{\text{RefWidth}_{\text{render}}}, \frac{\text{LayoutSpace}_{\text{Width}}}{\text{RefLength}_{\text{render}}}\right)$$

4. **Standard Scale Snapping**:
   $$N_{\text{raw}} = \frac{1}{\text{Scale Factor}}$$
   Find smallest $N \ge N_{\text{raw}}$ from predefined drafting scale options.

5. **Object Scaling & Centering**:
   $$\text{Final X} = (\text{Effective X}_{\text{render}} \times \text{ScaleFactor}) + \text{OffsetX}$$
   $$\text{Final Y} = (\text{Effective Y}_{\text{render}} \times \text{ScaleFactor}) + \text{OffsetY}$$

---

## Live Deployment

- **Live Webapp**: [https://kallium19.github.io/layout-scaler/](https://kallium19.github.io/layout-scaler/)
- **GitHub Repository**: [https://github.com/Kallium19/layout-scaler](https://github.com/Kallium19/layout-scaler)
