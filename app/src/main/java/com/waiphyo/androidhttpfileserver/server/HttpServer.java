package com.waiphyo.androidhttpfileserver.server;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;

import fi.iki.elonen.NanoHTTPD;

/**
 * Serveur HTTP basé sur NanoHTTPD.
 * Gère les requêtes pour l'API de fichiers, les téléchargements et les ressources statiques Web.
 */
public class HttpServer extends NanoHTTPD {
    private static final String TAG = "HttpServer";
    private final Context mContext;
    private final String mRootPath;

    public HttpServer(Context context, int port, String rootPath) {
        super(port);
        this.mContext = context;
        this.mRootPath = rootPath;
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        Method method = session.getMethod();
        Log.d(TAG, "Requête reçue: " + method + " " + uri);

        // 1. API: Liste des fichiers au format JSON
        if ("/api/files".equals(uri)) {
            return handleFileListApi(session);
        }

        // 1b. API: Suppression de fichier ou dossier
        if ("/api/delete".equals(uri)) {
            return handleDeleteApi(session);
        }

        // 1c. API: Nouveau dossier
        if ("/api/mkdir".equals(uri)) {
            return handleMkdirApi(session);
        }

        // 2. TÉLÉCHARGEMENT: Sert les fichiers réels du stockage Android
        if (uri.startsWith("/download/")) {
            return handleDownload(uri.substring("/download/".length()));
        }

        // 3. RESSOURCES STATIQUES: Sert l'interface Web (HTML/JS/CSS) depuis les assets
        String assetPath = "web" + uri;
        if ("/".equals(uri)) assetPath = "web/index.html";
        
        try {
            InputStream is = mContext.getAssets().open(assetPath);
            String mimeType = resolveMimeType(assetPath);
            return newChunkedResponse(Response.Status.OK, mimeType, is);
        } catch (IOException e) {
            // Si le fichier n'est pas trouvé dans les assets, renvoie une erreur 404
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Fichier non trouvé");
        }
    }

    /**
     * Parcourt le stockage externe pour renvoyer une liste de fichiers JSON.
     */
    private Response handleFileListApi(IHTTPSession session) {
        String path = session.getParameters().get("path") != null ? session.getParameters().get("path").get(0) : null;
        if (path == null) path = "";
        
        File root = new File(mRootPath);
        File targetDir = path.isEmpty() ? root : new File(root, path);

        if (!targetDir.exists() || !targetDir.isDirectory()) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "[]");
        }

        File[] files = targetDir.listFiles();
        StringBuilder json = new StringBuilder("[");
        if (files != null) {
            // Tri : Dossiers d'abord, puis fichiers par nom (insensible à la casse)
            Arrays.sort(files, (f1, f2) -> {
                if (f1.isDirectory() && !f2.isDirectory()) return -1;
                if (!f1.isDirectory() && f2.isDirectory()) return 1;
                return f1.getName().compareToIgnoreCase(f2.getName());
            });

            for (int i = 0; i < files.length; i++) {
                File f = files[i];
                boolean isDir = f.isDirectory();
                String relativePath = path.isEmpty() ? f.getName() : path + "/" + f.getName();
                
                json.append("{");
                json.append("\"name\":\"").append(f.getName()).append("\",");
                json.append("\"isDir\":").append(isDir).append(",");
                json.append("\"path\":\"").append(relativePath).append("\",");
                json.append("\"size\":\"").append(isDir ? "--" : formatSize(f.length())).append("\"");
                json.append("}");
                if (i < files.length - 1) json.append(",");
            }
        }
        json.append("]");
        return newFixedLengthResponse(Response.Status.OK, "application/json", json.toString());
    }

    /**
     * Gère la suppression d'un fichier ou d'un dossier.
     */
    private Response handleDeleteApi(IHTTPSession session) {
        String path = session.getParameters().get("path") != null ? session.getParameters().get("path").get(0) : null;
        if (path == null || path.isEmpty()) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "Chemin manquant");
        }

        File fileToDelete = new File(mRootPath, path);
        if (!fileToDelete.exists()) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Fichier non trouvé");
        }

        try {
            if (deleteRecursive(fileToDelete)) {
                return newFixedLengthResponse(Response.Status.OK, "text/plain", "Supprimé avec succès");
            } else {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Échec de la suppression");
            }
        } catch (Exception e) {
            return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Erreur: " + e.getMessage());
        }
    }

    /**
     * Gère la création d'un nouveau dossier.
     */
    private Response handleMkdirApi(IHTTPSession session) {
        String parentPath = session.getParameters().get("parentPath") != null ? session.getParameters().get("parentPath").get(0) : null;
        String name = session.getParameters().get("name") != null ? session.getParameters().get("name").get(0) : null;

        if (parentPath == null || name == null) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "Paramètres manquants");
        }

        File newDir = new File(mRootPath, parentPath.isEmpty() ? name : parentPath + "/" + name);
        if (newDir.exists()) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "Le dossier existe déjà");
        }

        if (newDir.mkdirs()) {
            return newFixedLengthResponse(Response.Status.OK, "text/plain", "Dossier créé");
        } else {
            return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Échec de la création");
        }
    }

    /**
     * Supprime un fichier ou un dossier récursivement.
     */
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
     * Lit un fichier depuis le disque pour le proposer au téléchargement.
     */
    private Response handleDownload(String filePath) {
        try {
            File root = new File(mRootPath);
            File file = new File(root, filePath);
            
            if (file.exists() && file.isFile()) {
                InputStream is = new FileInputStream(file);
                Response response = newChunkedResponse(Response.Status.OK, resolveMimeType(file.getName()), is);
                // Ajout de l'en-tête Content-Disposition pour forcer le téléchargement
                response.addHeader("Content-Disposition", "attachment; filename=\"" + file.getName() + "\"");
                return response;
            }
        } catch (IOException e) {
            Log.e(TAG, "Erreur lors du téléchargement", e);
        }
        return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Fichier non trouvé");
    }

    /**
     * Détermine le type MIME en fonction de l'extension du fichier.
     */
    private String resolveMimeType(String uri) {
        if (uri.endsWith(".html")) return "text/html";
        if (uri.endsWith(".js")) return "application/javascript";
        if (uri.endsWith(".css")) return "text/css";
        if (uri.endsWith(".png")) return "image/png";
        if (uri.endsWith(".jpg") || uri.endsWith(".jpeg")) return "image/jpeg";
        if (uri.endsWith(".pdf")) return "application/pdf";
        if (uri.endsWith(".zip")) return "application/zip";
        return "application/octet-stream";
    }

    /**
     * Formate la taille d'un fichier en unités lisibles (Ko, Mo, Go).
     */
    private String formatSize(long size) {
        if (size <= 0) return "0 o";
        final String[] units = new String[]{"o", "Ko", "Mo", "Go", "To"};
        int digitGroups = (int) (Math.log10(size) / Math.log10(1024));
        return new java.text.DecimalFormat("#,##0.#").format(size / Math.pow(1024, digitGroups)) + " " + units[digitGroups];
    }
}
