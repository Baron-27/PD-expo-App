from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import subprocess
import socket
import logging

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
    subprocess.run([  # Run the YOLOv5 segmentation command
        "python", f"{YOLOV5_DIR}/segment/predict.py",
        "--imgsz", "640",
        "--hide-labels",
        "--line-thickness", "1",
        "--conf", "0.7",
        "--weights", WEIGHTS_PATH,
        "--source", str(temp_image_path),
        "--project", str(OUTPUT_DIR),  # Change output directory to OUTPUT_DIR
    ])

    # Locate the processed images in the YOLOv5 output folder (e.g., OUTPUT_DIR/exp*)
    output_folder = list(OUTPUT_DIR.glob("exp*"))

    # Raise an error if no processed images are found
    if not output_folder:
        raise HTTPException(status_code=500, detail="YOLOv5 segmentation failed to produce output.")

    # Get the most recent processed image based on the timestamp
    latest_exp_dir = max(output_folder, key=lambda d: d.stat().st_mtime)
    processed_images = list(latest_exp_dir.glob("*.jpg"))

    if not processed_images:
        raise HTTPException(status_code=500, detail="No processed images found.")
    latest_seg_image = max(processed_images, key=lambda f: f.stat().st_mtime)

    return {"message": "Processing successful."}

@app.get('/outputfile/')
async def view_segmented_image():
    """
    Serve the most recent processed image URL from the output directory.
    """
    print("Fetching the latest processed image...")

    # Find all subdirectories in the output directory matching "exp*"
    exp_dirs = list(OUTPUT_DIR.glob("exp*"))
    if not exp_dirs:
        raise HTTPException(status_code=404, detail="No output directories found.")

    # Get the most recent "exp*" directory based on modification time
    latest_exp_dir = max(exp_dirs, key=lambda d: d.stat().st_mtime)

    # Find all image files in the latest directory
    processed_images = list(latest_exp_dir.glob("*.jpg"))
    if not processed_images:
        raise HTTPException(status_code=404, detail="No processed images found in the latest directory.")

    # Get the latest image based on modification time
    latest_image = max(processed_images, key=lambda f: f.stat().st_mtime)

    # Construct the URL to the latest processed image
    
    file_url = f"http://192.168.1.238:8000/images/{latest_exp_dir.name}/{latest_image.name}"

    print("Constructed file URL:", file_url)

    return {"file": file_url}
