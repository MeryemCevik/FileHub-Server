package com.waiphyo.androidhttpfileserver.server;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.ThumbnailUtils;
import android.provider.MediaStore;

/**
 * Gère toutes les opérations sur le système de fichiers.
 */
public class FileManager {
    private final String rootPath;

    public FileManager(String rootPath) {
        this.rootPath = rootPath;
    }

    /**
     * Compresse les fichiers et dossiers sélectionnés dans un ZipOutputStream.
     * Les éléments sélectionnés seront à la racine de l'archive ZIP.
     */
    public void createZip(List<String> relativePaths, ZipOutputStream zos) throws IOException {
        for (String path : relativePaths) {
            File file = new File(rootPath, path);
            if (file.exists()) {
                // On commence le nom de l'entrée ZIP par le nom du fichier/dossier lui-même
                // et non par son chemin complet depuis la racine.
                addToZip(file, file.getName(), zos);
            }
        }
    }

    private void addToZip(File file, String zipEntryName, ZipOutputStream zos) throws IOException {
        if (file.isDirectory()) {
            // Toujours créer l'entrée pour le dossier (finit par un slash)
            // C'est indispensable pour que le dossier existe dans le ZIP même s'il est vide
            ZipEntry dirEntry = new ZipEntry(zipEntryName + "/");
            zos.putNextEntry(dirEntry);
            zos.closeEntry();

            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    // Appel récursif pour les enfants
                    addToZip(child, zipEntryName + "/" + child.getName(), zos);
                }
            }
        } else {
            // C'est un fichier
            try (FileInputStream fis = new FileInputStream(file)) {
                ZipEntry zipEntry = new ZipEntry(zipEntryName);
                zos.putNextEntry(zipEntry);
                byte[] buffer = new byte[8192];
                int length;
                while ((length = fis.read(buffer)) >= 0) {
                    zos.write(buffer, 0, length);
                }
                zos.closeEntry();
            }
        }
    }

    public String getRootName() {
        File root = new File(rootPath);
        String name = root.getName();
        if (name.isEmpty() || rootPath.equals("/storage/emulated/0") || rootPath.equals("/")) {
            return "Racine";
        }
        return name;
    }

    public String getFileListJson(String relativePath) {
        return getFileListJson(relativePath, false);
    }

    public String getFileListJson(String relativePath, boolean recursiveImagesOnly) {
        File targetDir = new File(rootPath, relativePath);
        if (!targetDir.exists() || !targetDir.isDirectory()) return "[]";

        StringBuilder json = new StringBuilder("[");
        if (recursiveImagesOnly) {
            List<File> allImages = new ArrayList<>();
            findImagesRecursive(targetDir, allImages);
            for (int i = 0; i < allImages.size(); i++) {
                File f = allImages.get(i);
                String fullPath = f.getAbsolutePath();
                String relPath = fullPath.substring(new File(rootPath).getAbsolutePath().length());
                if (relPath.startsWith(File.separator)) relPath = relPath.substring(1);
                relPath = relPath.replace(File.separatorChar, '/');

                appendFileJson(json, f, relPath);
                if (i < allImages.size() - 1) json.append(",");
            }
        } else {
            File[] files = targetDir.listFiles();
            if (files != null) {
                Arrays.sort(files, (f1, f2) -> {
                    if (f1.isDirectory() && !f2.isDirectory()) return -1;
                    if (!f1.isDirectory() && f2.isDirectory()) return 1;
                    return f1.getName().compareToIgnoreCase(f2.getName());
                });

                for (int i = 0; i < files.length; i++) {
                    File f = files[i];
                    String path = relativePath.isEmpty() ? f.getName() : relativePath + "/" + f.getName();
                    appendFileJson(json, f, path);
                    if (i < files.length - 1) json.append(",");
                }
            }
        }
        json.append("]");
        return json.toString();
    }

    private void findImagesRecursive(File dir, List<File> result) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) {
                findImagesRecursive(f, result);
            } else {
                String name = f.getName().toLowerCase();
                if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || 
                    name.endsWith(".webp") || name.endsWith(".gif")) {
                    result.add(f);
                }
            }
        }
    }

    private void appendFileJson(StringBuilder json, File f, String path) {
        boolean isDir = f.isDirectory();
        json.append("{");
        json.append("\"name\":\"").append(f.getName()).append("\",");
        json.append("\"isDir\":").append(isDir).append(",");
        json.append("\"path\":\"").append(path).append("\",");
        json.append("\"size\":\"").append(isDir ? "--" : formatSize(f.length()));
        json.append("\"}");
    }

    public boolean saveFile(String targetRelativePath, String fileName, File tempFile) {
        try {
            // 1. Validation du nom de fichier
            if (fileName == null || fileName.trim().isEmpty() || fileName.contains("/") || fileName.contains("\\")) {
                return false;
            }

            File targetDir = new File(rootPath, targetRelativePath);
            if (!targetDir.exists() && !targetDir.mkdirs()) return false;

            // 2. Vérification de l'espace disque disponible
            long requiredSpace = tempFile.length();
            if (targetDir.getFreeSpace() < requiredSpace) {
                return false; // Pas assez d'espace
            }

            File dest = new File(targetDir, fileName);
            
            // Gestion des doublons
            if (dest.exists()) {
                String baseName = fileName;
                String extension = "";
                int dotIndex = fileName.lastIndexOf('.');
                if (dotIndex > 0) {
                    baseName = fileName.substring(0, dotIndex);
                    extension = fileName.substring(dotIndex);
                }
                int count = 1;
                while (dest.exists()) {
                    dest = new File(targetDir, baseName + "_" + count + extension);
                    count++;
                }
            }

            // Tentative de déplacement rapide
            if (tempFile.renameTo(dest)) {
                return true;
            } else {
                // Secours : Copie manuelle (nécessaire si on change de partition mémoire)
                return copyFile(tempFile, dest);
            }
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private boolean copyFile(File src, File dst) {
        try (InputStream in = new FileInputStream(src);
             OutputStream out = new FileOutputStream(dst)) {
            byte[] buf = new byte[8192];
            int len;
            while ((len = in.read(buf)) > 0) {
                out.write(buf, 0, len);
            }
            return true;
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
    }

    public boolean deleteItem(String relativePath) {
        File file = new File(rootPath, relativePath);
        if (!file.exists()) return false;
        return deleteRecursive(file);
    }

    private boolean deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory.isDirectory()) {
            File[] children = fileOrDirectory.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursive(child);
            }
        }
        return fileOrDirectory.delete();
    }

    public boolean makeDirectory(String parentPath, String folderName) {
        File newDir = new File(rootPath, parentPath.isEmpty() ? folderName : parentPath + "/" + folderName);
        return !newDir.exists() && newDir.mkdirs();
    }

    public boolean renameItem(String oldRelativePath, String newName) {
        // Validation du nouveau nom
        if (newName == null || newName.trim().isEmpty() || newName.contains("/") || newName.contains("\\")) {
            return false;
        }

        File oldFile = new File(rootPath, oldRelativePath);
        if (!oldFile.exists()) {
            return false;
        }

        // Extraction du répertoire parent
        String parentPath = "";
        int lastSeparator = oldRelativePath.lastIndexOf('/');
        if (lastSeparator > 0) {
            parentPath = oldRelativePath.substring(0, lastSeparator);
        }

        // Création du nouveau chemin
        File newFile = new File(rootPath, parentPath.isEmpty() ? newName : parentPath + "/" + newName);

        // Vérification que le nouveau nom n'existe pas déjà
        if (newFile.exists()) {
            return false;
        }

        // Effectuer le renommage
        return oldFile.renameTo(newFile);
    }

    public File getFile(String relativePath) {
        File file = new File(rootPath, relativePath);
        return (file.exists() && file.isFile()) ? file : null;
    }

    /**
     * Génère une miniature compressée pour une image.
     */
    public InputStream getThumbnail(File file) {
        try {
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = 4; // Réduction de la taille par 4 pour économiser de la RAM
            Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath(), options);
            
            if (bitmap == null) return null;

            // Création d'une miniature carrée de 300px
            Bitmap thumb = ThumbnailUtils.extractThumbnail(bitmap, 300, 300);
            bitmap.recycle();

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            thumb.compress(Bitmap.CompressFormat.JPEG, 70, bos);
            thumb.recycle();
            
            return new ByteArrayInputStream(bos.toByteArray());
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    public String formatSize(long size) {
        if (size <= 0) return "0 o";
        final String[] units = new String[]{"o", "Ko", "Mo", "Go", "To"};
        int digitGroups = (int) (Math.log10(size) / Math.log10(1024));
        return new java.text.DecimalFormat("#,##0.#").format(size / Math.pow(1024, digitGroups)) + " " + units[digitGroups];
    }
}
