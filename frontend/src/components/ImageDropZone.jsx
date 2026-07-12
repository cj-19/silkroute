import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// Televerse un fichier image sur Cloudinary via la signature fournie par le
// backend, et retourne l'URL publique de l'image.
export const uploadImageToCloudinary = async (file, folder = 'groupages/products') => {
  const sigResponse = await api.get(`/cloudinary/signature?folder=${folder}`);
  const sig = sigResponse.data;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', sig.api_key);
  formData.append('timestamp', sig.timestamp);
  formData.append('signature', sig.signature);
  formData.append('folder', sig.folder);

  const uploadResponse = await axios.post(
    `https://api.cloudinary.com/v1_1/${sig.cloud_name}/auto/upload`,
    formData
  );
  return uploadResponse.data.secure_url;
};

// Zone de glisser-deposer d'image, avec apercu integre et clic pour parcourir.
// value = URL actuelle de l'image, onChange(url) = appele apres televersement.
const ImageDropZone = ({ value, onChange, fr = true, folder = 'groupages/products' }) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(fr ? 'Seuls les fichiers image sont acceptés' : 'Image files only');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(fr ? 'Image trop lourde (max 10MB)' : 'Image too large (max 10MB)');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImageToCloudinary(file, folder);
      onChange(url);
      toast.success(fr ? 'Image téléversée!' : 'Image uploaded!');
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error(error.response?.data?.detail || (fr ? "Échec de l'envoi de l'image" : 'Image upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`relative w-full h-40 rounded-md border-2 border-dashed cursor-pointer flex items-center justify-center overflow-hidden transition-colors ${
        dragOver ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-[#2A2A2A] hover:border-[#71717A]'
      }`}
      data-testid="image-dropzone"
    >
      {value && (
        <img
          src={value}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}

      {/* data-theme-fixed : le badge reste lisible (texte blanc sur fond noir)
          par-dessus l'image, dans les deux themes */}
      <div
        data-theme-fixed
        className={`relative z-10 text-center text-xs px-4 py-2 rounded-md ${
          value ? 'bg-black/60 text-white' : 'text-[#71717A]'
        }`}
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        ) : (
          <>
            <Upload className="w-5 h-5 mx-auto mb-1" />
            {fr
              ? 'Glissez-déposez une image ici, ou cliquez pour choisir un fichier'
              : 'Drag & drop an image here, or click to browse'}
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }}
      />
    </div>
  );
};

export default ImageDropZone;
