from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import subprocess
import socket

# Define directories
UPLOAD_DIR = Path('C:/Users/Jemo/currentPyworks/uploads')
YOLOV5_DIR = "C:/Users/Jemo/currentPyworks/yolov5"
WEIGHTS_PATH = "C:/Users/Jemo/currentPyworks/current_best.pt"
OUTPUT_DIR = Path('C:/Users/Jemo/currentPyworks/output')

# Ensure the upload and output directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI()

# Mount the OUTPUT_DIR as a static directory so that processed images can be accessed publicly
app.mount("/images", StaticFiles(directory=OUTPUT_DIR), name="images")

@app.post('/uploadfile/')
async def process_and_save_image(file_upload: UploadFile):
    """
    Handles image upload, processes it with YOLOv5 segmentation, and saves the output.
    """
    # Save the uploaded file temporarily
    temp_image_path = UPLOAD_DIR / file_upload.filename
    with open(temp_image_path, "wb") as f:
        data = await file_upload.read()
        f.write(data)

    # Run YOLOv5 segmentation
    print("Processing image with YOLOv5...")
    subprocess.run([
        "python", f"{YOLOV5_DIR}/segment/predict.py",
        "--imgsz", "640",
        "--hide-labels",
        "--line-thickness", "1",
        "--conf", "0.7",
        "--weights", WEIGHTS_PATH,
        "--source", str(temp_image_path),
        "--project", str(OUTPUT_DIR),  # Change output directory to OUTPUT_DIR
    ])

    # Locate the processed images in the YOLOv5 output folder (e.g., OUTPUT_DIR/exp/)
    output_folder = OUTPUT_DIR / "exp"
    processed_images = list(output_folder.rglob("*.jpg"))

    # Raise an error if no processed images are found
    if not processed_images:
        raise HTTPException(status_code=500, detail="YOLOv5 segmentation failed to produce output.")

    # Return the URL to the processed image
    processed_image_url = f"/images/exp/{processed_images[0].name}"  # Return the image URL
    return {"image_url": processed_image_url}

@app.get('/outputfile/')
async def view_segmented_image():
    files = list(OUTPUT_DIR.rglob("*.*"))
    if not files:
        raise HTTPException(status_code=404, detail="No files found in the output directory.")
     # Get the latest file based on modification time
    latest_file = max(files, key=lambda f: f.stat().st_mtime)

    # Construct the file's URL
    server_ip = socket.gethostbyname(socket.gethostname())
    file_url = f"http://{server_ip}:8000/images/{latest_file.relative_to(OUTPUT_DIR).as_posix()}"

    return {"file": file_url}
