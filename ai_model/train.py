import os
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from dataset import OilSpillSegmentationDataset
from model import UNet

# --- Configuration (Optimized for 4GB VRAM / 8GB RAM) ---
BATCH_SIZE = 2          # Reduced from 8 to fit in 4GB VRAM
EPOCHS = 15             # 15 epochs is enough for a strong MVP demo
LEARNING_RATE = 1e-3
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Paths (relative to ~/SIH/ai_model)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAIN_IMG_DIR = os.path.join(BASE_DIR, "dataset/images/train")
TRAIN_MASK_DIR = os.path.join(BASE_DIR, "dataset/masks/train")
VAL_IMG_DIR = os.path.join(BASE_DIR, "dataset/images/val")
VAL_MASK_DIR = os.path.join(BASE_DIR, "dataset/masks/val")
WEIGHTS_DIR = os.path.join(BASE_DIR, "weights")

# Ensure weights directory exists
os.makedirs(WEIGHTS_DIR, exist_ok=True)

def main():
    print(f"🚀 Using device: {DEVICE}")
    
    # 1. Initialize Datasets and DataLoaders
        # 1. Initialize Datasets and DataLoaders
    train_dataset = OilSpillSegmentationDataset(TRAIN_IMG_DIR, TRAIN_MASK_DIR, augment=True)
    val_dataset = OilSpillSegmentationDataset(VAL_IMG_DIR, VAL_MASK_DIR, augment=False)
    
    # num_workers=0 prevents RAM overhead from multiprocessing (crucial for 8GB RAM)
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    
    print(f"✅ Loaded {len(train_dataset)} training samples and {len(val_dataset)} validation samples.")

    # 2. Initialize Model, Loss, and Optimizer
    model = UNet(in_channels=1, out_channels=1).to(DEVICE)
    
    # BCELoss is used because our UNet model outputs a sigmoid activation
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    best_val_loss = float('inf')

    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    # 3. Training Loop
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        
        for images, masks, _ in train_loader:
            images, masks = images.to(DEVICE), masks.to(DEVICE)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
        
        train_loss /= len(train_loader)

        # 4. Validation Loop
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for images, masks, _ in val_loader:
                images, masks = images.to(DEVICE), masks.to(DEVICE)
                outputs = model(images)
                loss = criterion(outputs, masks)
                val_loss += loss.item()
        
        val_loss /= len(val_loader)

        print(f"Epoch [{epoch+1}/{EPOCHS}] | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")

        # 5. Save Best Model
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            save_path = os.path.join(WEIGHTS_DIR, "unet_best.pth")
            torch.save(model.state_dict(), save_path)
            print(f"💾 Saved new best model to {save_path}")

    print("🎉 Training complete!")

if __name__ == "__main__":
    main()