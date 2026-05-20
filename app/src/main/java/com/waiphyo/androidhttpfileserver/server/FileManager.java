package com.waiphyo.androidhttpfileserver.server;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;

/**
 * Gère toutes les opérations sur le système de fichiers.
 */
public class FileManager {
    private final String rootPath;

    public FileManager(String rootPath) {
        this.rootPath = rootPath;
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
        File targetDir = new File(rootPath, relativePath);
        if (!targetDir.exists() || !targetDir.isDirectory()) return "[]";

        File[] files = targetDir.listFiles();
        StringBuilder json = new StringBuilder("[");
        if (files != null) {
            Arrays.sort(files, (f1, f2) -> {
                if (f1.isDirectory() && !f2.isDirectory()) return -1;
                if (!f1.isDirectory() && f2.isDirectory()) return 1;
                return f1.getName().compareToIgnoreCase(f2.getName());
            });

            for (int i = 0; i < files.length; i++) {
                File f = files[i];
                boolean isDir = f.isDirectory();
                String path = relativePath.isEmpty() ? f.getName() : relativePath + "/" + f.getName();
                
                json.append("{");
                json.append("\"name\":\"").append(f.getName()).append("\",");
                json.append("\"isDir\":").append(isDir).append(",");
                json.append("\"path\":\"").append(path).append("\",");
                json.append("\"size\":\"").append(isDir ? "--" : formatSize(f.length()));
                json.append("\"}");
                if (i < files.length - 1) json.append(",");
            }
        }
        json.append("]");
        return json.toString();
    }

    public boolean saveFile(String targetRelativePath, String fileName, File tempFile) {
        try {
            File targetDir = new File(rootPath, targetRelativePath);
            if (!targetDir.exists() && !targetDir.mkdirs()) return false;

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

    public File getFile(String relativePath) {
        File file = new File(rootPath, relativePath);
        return (file.exists() && file.isFile()) ? file : null;
    }

    public String formatSize(long size) {
        if (size <= 0) return "0 o";
        final String[] units = new String[]{"o", "Ko", "Mo", "Go", "To"};
        int digitGroups = (int) (Math.log10(size) / Math.log10(1024));
        return new java.text.DecimalFormat("#,##0.#").format(size / Math.pow(1024, digitGroups)) + " " + units[digitGroups];
    }
}
