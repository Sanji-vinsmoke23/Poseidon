import os
import cv2
import numpy as np
import torch
from torch.utils.data import Dataset
import torchvision.transforms as transforms

class OilSpillSegmentationDataset(Dataset):
    def __init__(self, images_dir, masks_dir, augment=False):
        self.images_dir = images_dir
        self.masks_dir = masks_dir
        self.augment = augment
        
        # Data augmentation for SAR imagery (orientation doesn't matter)
        if self.augment:
            self.transform = transforms.Compose([
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomVerticalFlip(p=0.5),
            ])
        else:
            self.transform = None

        # Get all image filenames
        self.image_names = sorted([f for f in os.listdir(images_dir) if f.endswith(('.jpg', '.png', '.tif'))])

    def __len__(self):
        return len(self.image_names)

    def __getitem__(self, idx):
        img_name = self.image_names[idx]
        img_path = os.path.join(self.images_dir, img_name)
        
        # Assume mask has the exact same filename as the image
        mask_path = os.path.join(self.masks_dir, img_name)
        
        # Fallback if mask has a suffix like '_mask.png'
        if not os.path.exists(mask_path):
            base_name = os.path.splitext(img_name)[0]
            mask_path = os.path.join(self.masks_dir, f"{base_name}_mask.png")

        # Load image (grayscale for SAR VV polarization)
        image = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        image = cv2.resize(image, (256, 256))
        image = image / 255.0 # Normalize to [0, 1]
        image = np.expand_dims(image, axis=0) # Shape: (1, 256, 256)

        # Load mask (binary: 0 or 1)
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        mask = cv2.resize(mask, (256, 256))
        mask = (mask > 127).astype(np.float32) # Binarize
        mask = np.expand_dims(mask, axis=0) # Shape: (1, 256, 256)

        # Apply augmentations (must apply same transform to image and mask)
        if self.transform:
            # Combine image and mask into a single tensor for joint transformation
            combined = np.concatenate([image, mask], axis=0)
            combined_tensor = torch.tensor(combined, dtype=torch.float32)
            transformed = self.transform(combined_tensor)
            image = transformed[0:1, :, :]
            mask = transformed[1:2, :, :]
        else:
            image = torch.tensor(image, dtype=torch.float32)
            mask = torch.tensor(mask, dtype=torch.float32)

        return image, mask, img_name