FROM python:3.10-slim

# Install system dependencies (Tesseract OCR and OpenCV requirements)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces strictly requires apps to run as a non-root user (User ID 1000)
RUN useradd -m -u 1000 user
USER user

# Set up the working directory inside the container
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy the requirements file and install Python packages
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the rest of the application files to the container
COPY --chown=user . .

# Hugging Face expects the app to listen on port 7860
EXPOSE 7860

# Run the Flask app
CMD ["python", "server.py"]
