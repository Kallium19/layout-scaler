# Layout Scaler Webapp

A web application designed for students and architects to convert real-world architectural dimensions and furniture layouts into scaled, render-ready drafting dimensions and coordinates.

## Features

- **Unit Consistency**: Select global units (`mm`, `cm`, `m`, `in`, `ft`) that dynamically apply across all input fields, results, and table outputs.
- **Layout Space & Margin Check**: Computes usable drafting area by subtracting Annotation Space (margins/labels) from total Drawable Area.
- **Orientation Fitting (0° vs 90°)**: Tests layout orientation choices to automatically pick the orientation that maximizes usable sheet scale factor.
- **Standard Drafting Scale Snapping**: Converts raw scale factors into standard drafting scales ($1:N \in [1, 2, 5, 10, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000]$) to comply with drafting standards.
- **Scaled Object Coordinates & Centering**: Automatically calculates scaled object sizes and positions with centering offsets so scaled drawings align in the usable sheet area.
- **Validation & Out-of-Bounds Flagging**: Validates numeric inputs and flags any object extending past reference layout boundaries.
- **CSV & JSON Data Export**: Download the scaled object table as a `.csv` or `.json` file for drafting reference.

---

## Math & Calculation Specs

1. **Layout Space**:
   $$\text{LayoutSpace}_{\text{Length}} = \text{DrawableArea}_{\text{Length}} - \text{AnnotationSpace}_{\text{Length}}$$
   $$\text{LayoutSpace}_{\text{Width}} = \text{DrawableArea}_{\text{Width}} - \text{AnnotationSpace}_{\text{Width}}$$

2. **Candidate Scale Factor**:
   - **Orientation A (0°)**:
     $$\text{Scale}_A = \min\left(\frac{\text{LayoutSpace}_{\text{Length}}}{\text{ReferenceSize}_{\text{Length}}}, \frac{\text{LayoutSpace}_{\text{Width}}}{\text{ReferenceSize}_{\text{Width}}}\right)$$
   - **Orientation B (90°)**:
     $$\text{Scale}_B = \min\left(\frac{\text{LayoutSpace}_{\text{Length}}}{\text{ReferenceSize}_{\text{Width}}}, \frac{\text{LayoutSpace}_{\text{Width}}}{\text{ReferenceSize}_{\text{Length}}}\right)$$

3. **Standard Scale Snapping**:
   $$N_{\text{raw}} = \frac{1}{\text{Scale Factor}}$$
   Find smallest $N \ge N_{\text{raw}}$ from predefined drafting scale options.

4. **Object Scaling & Centering**:
   $$\text{Final X} = (\text{Effective X} \times \text{ScaleFactor}) + \text{OffsetX}$$
   $$\text{Final Y} = (\text{Effective Y} \times \text{ScaleFactor}) + \text{OffsetY}$$

---

## How to Deploy to GitHub Pages

1. Initialize git and commit your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Layout Scaler Webapp"
   git branch -M main
   ```
2. Add your GitHub repository remote:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/layout-scaler.git
   git push -u origin main
   ```
3. Enable GitHub Pages:
   - Navigate to **Repo Settings > Pages**.
   - Under **Build and deployment > Branch**, select `main` and `/ (root)`.
   - Click **Save**.

Live Site URL:
`https://YOUR_USERNAME.github.io/layout-scaler/`
