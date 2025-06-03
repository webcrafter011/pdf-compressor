const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const port = 7000;

// Configure Multer (ensure uploads and compressed_pdfs directories exist)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
  },
});
const upload = multer({ storage: storage });

const compressionSettings = {
  little: { level: "/screen", imageResolution: "72" },
  middle: { level: "/ebook", imageResolution: "150" },
  high: { level: "/printer", imageResolution: "300" },
};

app.post("/compress-pdf", upload.single("pdfFile"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No PDF file uploaded." });
  }

  const compressionLevel = req.body.compressionLevel || "middle";
  const settings = compressionSettings[compressionLevel];

  if (!settings) {
    fs.unlink(req.file.path, (err) => {
      if (err)
        console.error("Error deleting uploaded file on invalid settings:", err);
    });
    return res.status(400).json({
      message: "Invalid compression level. Choose from: little, middle, high.",
    });
  }

  const inputPath = req.file.path;
  const originalNameSanitized = req.file.originalname
    .replace(/[^a-zA-Z0-9.]/g, "_")
    .replace(/\.pdf$/i, "");
  const outputFileName = `compressed-${Date.now()}-${originalNameSanitized}.pdf`;
  const outputPath = path.join("compressed_pdfs", outputFileName);

  const compressedDir = "compressed_pdfs/";
  if (!fs.existsSync(compressedDir)) fs.mkdirSync(compressedDir);

  const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 \
                     -dPDFSETTINGS=${settings.level} \
                     -dNOPAUSE -dQUIET -dBATCH \
                     -dDetectDuplicateImages=true \
                     -dColorImageResolution=${settings.imageResolution} \
                     -dGrayImageResolution=${settings.imageResolution} \
                     -dMonoImageResolution=${settings.imageResolution} \
                     -sOutputFile="${outputPath}" "${inputPath}"`;

  console.log(`Executing Ghostscript: ${gsCommand}`);
  exec(gsCommand, (error, stdout, stderr) => {
    fs.unlink(inputPath, (err) => {
      if (err) console.error("Error deleting uploaded file:", err);
    });

    if (error) {
      console.error(`Ghostscript error: ${error.message}`);
      console.error(`Ghostscript stderr: ${stderr}`);
      return res
        .status(500)
        .json({ message: `Error compressing PDF: ${stderr || error.message}` });
    }
    if (stderr) console.warn(`Ghostscript stderr (warnings): ${stderr}`);
    console.log(`PDF compressed successfully: ${outputPath}`);

    res.download(outputPath, outputFileName, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ message: "Error sending the compressed file." });
        }
      }
      fs.unlink(outputPath, (delErr) => {
        if (delErr) console.error("Error deleting compressed file:", delErr);
      });
    });
  });
});

// Modern Frontend
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Modern PDF Compressor</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --primary-color: #6e8efb;
          --secondary-color: #a777e3;
          --background-color: #f0f2f5;
          --card-background: #ffffff;
          --text-color: #333;
          --text-light: #555;
          --border-color: #e0e0e0;
          --success-color: #28a745;
          --error-color: #dc3545;
          --font-family: 'Poppins', sans-serif;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: var(--font-family);
          background-color: var(--background-color);
          /* background-image: linear-gradient(120deg, var(--primary-color) 0%, var(--secondary-color) 100%); */
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
          color: var(--text-color);
        }

        .compressor-container {
          background-color: var(--card-background);
          padding: 35px 45px;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 550px;
          text-align: center;
          transition: transform 0.3s ease;
        }

        .compressor-container:hover {
            /* transform: translateY(-5px); */
        }

        .header h1 {
          font-size: 28px;
          font-weight: 600;
          /* background: linear-gradient(to right, var(--primary-color), var(--secondary-color));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent; */
          color: var(--primary-color);
          margin-bottom: 10px;
        }

        .header p {
          font-size: 16px;
          color: var(--text-light);
          margin-bottom: 30px;
        }

        .upload-area {
          border: 2px dashed var(--border-color);
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.3s ease, background-color 0.3s ease;
          margin-bottom: 25px;
          background-color: #f9f9fc;
        }

        .upload-area.dragover {
          border-color: var(--primary-color);
          background-color: #eef2ff; /* Lighter shade of primary */
        }

        .upload-area input[type="file"] {
          display: none;
        }

        .upload-icon svg {
          width: 50px;
          height: 50px;
          fill: var(--primary-color);
          margin-bottom: 15px;
          transition: transform 0.3s ease;
        }
        .upload-area:hover .upload-icon svg {
            transform: scale(1.1);
        }

        .upload-text {
          font-size: 16px;
          font-weight: 500;
          color: var(--text-color);
        }
        .upload-hint {
          font-size: 13px;
          color: var(--text-light);
          margin-top: 5px;
        }
        #file-name-display {
            font-size: 14px;
            color: var(--primary-color);
            margin-top: 15px;
            font-weight: 500;
            word-break: break-all;
        }


        .options-group {
          margin-bottom: 30px;
        }

        .options-group label {
          display: block;
          font-size: 16px;
          font-weight: 500;
          color: var(--text-color);
          margin-bottom: 10px;
          text-align: left;
        }

        .custom-select-wrapper {
            position: relative;
        }

        .custom-select-wrapper select {
          width: 100%;
          padding: 12px 15px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: #fff;
          font-size: 15px;
          font-family: var(--font-family);
          color: var(--text-color);
          appearance: none; /* Remove default arrow */
          -webkit-appearance: none;
          -moz-appearance: none;
          cursor: pointer;
        }

        .custom-select-wrapper::after { /* Custom arrow */
            content: '▼';
            font-size: 12px;
            color: var(--primary-color);
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none; /* Allows click through to select */
        }


        .submit-btn {
          width: 100%;
          padding: 14px;
          border-radius: 8px;
          border: none;
          background-image: linear-gradient(to right, var(--primary-color) 0%, var(--secondary-color) 100%);
          color: white;
          font-size: 17px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 4px 15px rgba(110, 142, 251, 0.4);
        }

        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(110, 142, 251, 0.5);
        }

        .submit-btn:disabled {
          background-image: none;
          background-color: #ccc;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .status-area {
          margin-top: 25px;
          min-height: 20px; /* reserve space */
        }
        #status {
          font-size: 15px;
          font-weight: 500;
          text-align: center;
        }
        .status.success { color: var(--success-color); }
        .status.error { color: var(--error-color); }
        .status.info { color: var(--text-light); }

        .loader {
          width: 36px;
          height: 36px;
          border: 4px solid rgba(110, 142, 251, 0.2);
          border-left-color: var(--primary-color);
          border-radius: 50%;
          display: none; /* Initially hidden */
          margin: 20px auto 0;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 600px) {
          .compressor-container {
            margin: 20px;
            padding: 25px 20px;
          }
          .header h1 { font-size: 24px; }
          .header p { font-size: 14px; }
          .upload-area { padding: 20px; }
        }

      </style>
    </head>
    <body>
      <div class="compressor-container">
        <div class="header">
          <h1>PDF Power Squeeze</h1>
          <p>Reduce your PDF file size with selectable compression levels.</p>
        </div>

        <form id="uploadForm">
          <div class="upload-area" id="dropZone">
            <input type="file" id="pdfFile" name="pdfFile" accept=".pdf" required>
            <div class="upload-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
            </div>
            <p class="upload-text">Drag & Drop PDF here</p>
            <p class="upload-hint">or click to select file</p>
            <div id="file-name-display"></div>
          </div>

          <div class="options-group">
            <label for="compressionLevel">Compression Level:</label>
            <div class="custom-select-wrapper">
                <select id="compressionLevel" name="compressionLevel">
                <option value="little">Light (Screen Optimized)</option>
                <option value="middle" selected>Medium (eBook Quality)</option>
                <option value="high">Strong (Print Quality - Balances size & quality)</option>
                </select>
            </div>
          </div>

          <button type="submit" class="submit-btn" id="submitBtn">Compress PDF</button>
        </form>

        <div class="status-area">
            <div class="loader" id="loader"></div>
            <p id="status" class="status"></p>
        </div>
      </div>

      <script>
        const form = document.getElementById('uploadForm');
        const submitBtn = document.getElementById('submitBtn');
        const loader = document.getElementById('loader');
        const statusEl = document.getElementById('status');
        const fileInput = document.getElementById('pdfFile');
        const dropZone = document.getElementById('dropZone');
        const fileNameDisplay = document.getElementById('file-name-display');

        // Handle file selection via click
        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', function() {
          if (this.files && this.files.length > 0) {
            fileNameDisplay.textContent = 'Selected: ' + this.files[0].name;
            statusEl.textContent = ''; // Clear previous status
            statusEl.className = 'status';
          } else {
            fileNameDisplay.textContent = '';
          }
        });

        // Drag and Drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
          dropZone.addEventListener(eventName, preventDefaults, false);
          document.body.addEventListener(eventName, preventDefaults, false); // Prevent browser opening file
        });

        function preventDefaults(e) {
          e.preventDefault();
          e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
          dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
          dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });

        dropZone.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
          const dt = e.dataTransfer;
          const files = dt.files;

          if (files.length > 0) {
            const file = files[0];
            if (file.type === "application/pdf") {
              fileInput.files = files; // Assign dropped file to input
              fileNameDisplay.textContent = 'Selected: ' + file.name;
              statusEl.textContent = '';
              statusEl.className = 'status';
            } else {
              fileNameDisplay.textContent = '';
              statusEl.textContent = 'Please drop a PDF file.';
              statusEl.className = 'status error';
              fileInput.value = ''; // Clear any previously selected file
            }
          }
        }

        form.addEventListener('submit', async function(event) {
          event.preventDefault();

          if (!fileInput.files || fileInput.files.length === 0) {
            statusEl.textContent = 'Please select or drop a PDF file.';
            statusEl.className = 'status error';
            return;
          }

          loader.style.display = 'block';
          statusEl.textContent = 'Compressing your PDF... this may take a moment.';
          statusEl.className = 'status info';
          submitBtn.disabled = true;

          const formData = new FormData();
          formData.append('pdfFile', fileInput.files[0]);
          formData.append('compressionLevel', document.getElementById('compressionLevel').value);

          try {
            const response = await fetch('/compress-pdf', {
              method: 'POST',
              body: formData
            });

            if (response.ok) {
              const blob = await response.blob();
              const contentDisposition = response.headers.get('content-disposition');
              let filename = 'compressed.pdf';
              if (contentDisposition) {
                  const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                  if (filenameMatch && filenameMatch.length > 1) {
                      filename = filenameMatch[1];
                  }
              }

              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              a.remove();

              statusEl.textContent = 'Success! Your PDF is downloading.';
              statusEl.className = 'status success';
            } else {
              const errorData = await response.json();
              statusEl.textContent = 'Error: ' + (errorData.message || response.statusText);
              statusEl.className = 'status error';
            }
          } catch (error) {
            console.error('Fetch error:', error);
            statusEl.textContent = 'An unexpected error occurred. Please try again.';
            statusEl.className = 'status error';
          } finally {
            loader.style.display = 'none';
            submitBtn.disabled = false;
            // Don't reset file input here to allow re-submission if needed,
            // or if user wants to see which file they just processed.
            // fileNameDisplay.textContent = '';
            // fileInput.value = '';
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(
    `Modern PDF Compressor app listening at http://localhost:${port}`
  );
  // Create directories if they don't exist
  if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
  if (!fs.existsSync("compressed_pdfs")) fs.mkdirSync("compressed_pdfs");
});
