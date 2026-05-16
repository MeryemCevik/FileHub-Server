package com.waiphyo.androidhttpfileserver.server;

import android.content.Context;
import android.os.Environment;
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

    public HttpServer(Context context, int port) {
        super(port);
        this.mContext = context;
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
        
        File root = Environment.getExternalStorageDirectory();
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
     * Lit un fichier depuis le disque pour le proposer au téléchargement.
     */
    private Response handleDownload(String filePath) {
        try {
            File root = Environment.getExternalStorageDirectory();
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
        if (size <= 0) return "0 B";
        final String[] units = new String[]{"B", "KB", "MB", "GB", "TB"};
        int digitGroups = (int) (Math.log10(size) / Math.log10(1024));
        return new java.text.DecimalFormat("#,##0.#").format(size / Math.pow(1024, digitGroups)) + " " + units[digitGroups];
    }
}
