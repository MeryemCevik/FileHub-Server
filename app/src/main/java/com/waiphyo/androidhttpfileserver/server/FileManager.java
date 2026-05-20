package com.waiphyo.androidhttpfileserver.server;

import java.io.File;
import java.util.Arrays;

/**
 * Gère toutes les opérations sur le système de fichiers.
 * Cette classe sépare la logique métier de la logique réseau du serveur.
 */
public class FileManager {
    private final String rootPath;

    public FileManager(String rootPath) {
        this.rootPath = rootPath;
    }

    /**
     * Retourne la liste des fichiers d'un dossier au format JSON.
     */
    public String getFileListJson(String relativePath) {
        File targetDir = new File(rootPath, relativePath);

        if (!targetDir.exists() || !targetDir.isDirectory()) {
            return "[]";
        }

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

    /**
     * Supprime un fichier ou un dossier (récursivement).
     */
    public boolean deleteItem(String relativePath) {
        File file = new File(rootPath, relativePath);
        if (!file.exists()) return false;
        return deleteRecursive(file);
    }

    private boolean deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory.isDirectory()) {
            File[] children = fileOrDirectory.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        return fileOrDirectory.delete();
    }

    /**
     * Crée un nouveau dossier.
     */
    public boolean makeDirectory(String parentPath, String folderName) {
        File newDir = new File(rootPath, parentPath.isEmpty() ? folderName : parentPath + "/" + folderName);
        if (newDir.exists()) return false;
        return newDir.mkdirs();
    }

    /**
     * Retourne l'objet File pour le téléchargement.
     */
    public File getFile(String relativePath) {
        File file = new File(rootPath, relativePath);
        return (file.exists() && file.isFile()) ? file : null;
    }

    /**
     * Formate la taille en unités lisibles.
     */
    public String formatSize(long size) {
        if (size <= 0) return "0 o";
        final String[] units = new String[]{"o", "Ko", "Mo", "Go", "To"};
        int digitGroups = (int) (Math.log10(size) / Math.log10(1024));
        return new java.text.DecimalFormat("#,##0.#").format(size / Math.pow(1024, digitGroups)) + " " + units[digitGroups];
    }
}
