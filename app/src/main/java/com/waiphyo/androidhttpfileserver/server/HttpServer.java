package com.waiphyo.androidhttpfileserver.server;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

import fi.iki.elonen.NanoHTTPD;

/**
 * Serveur HTTP minimaliste.
 * Son rôle est uniquement de router les requêtes vers le FileManager.
 */
public class HttpServer extends NanoHTTPD {
    private static final String TAG = "HttpServer";
    private final Context mContext;
    private final FileManager fileManager;

    public HttpServer(Context context, int port, String rootPath) {
        super(port);
        this.mContext = context;
        this.fileManager = new FileManager(rootPath);
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        Method method = session.getMethod();
        Log.d(TAG, "Requête: " + method + " " + uri);

        // ROUTAGE API
        if ("/api/config".equals(uri)) {
            return newFixedLengthResponse(Response.Status.OK, "application/json", 
                "{\"rootName\":\"" + fileManager.getRootName() + "\"}");
        }

        if ("/api/files".equals(uri)) {
            String path = session.getParameters().get("path") != null ? session.getParameters().get("path").get(0) : "";
            return newFixedLengthResponse(Response.Status.OK, "application/json", fileManager.getFileListJson(path));
        }

        if ("/api/delete".equals(uri)) {
            String path = session.getParameters().get("path") != null ? session.getParameters().get("path").get(0) : "";
            if (fileManager.deleteItem(path)) {
                return newFixedLengthResponse(Response.Status.OK, "text/plain", "OK");
            }
            return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Erreur");
        }

        if ("/api/mkdir".equals(uri)) {
            String parent = session.getParameters().get("parentPath") != null ? session.getParameters().get("parentPath").get(0) : "";
            String name = session.getParameters().get("name") != null ? session.getParameters().get("name").get(0) : "";
            if (fileManager.makeDirectory(parent, name)) {
                return newFixedLengthResponse(Response.Status.OK, "text/plain", "OK");
            }
            return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Erreur");
        }

        if ("/api/upload".equals(uri) && method == Method.POST) {
            Map<String, String> files = new HashMap<>();
            try {
                session.parseBody(files);
                String path = session.getParameters().get("path") != null ? session.getParameters().get("path").get(0) : "";
                
                // Dans NanoHTTPD, "file" est le nom du champ dans le formulaire HTML
                if (files.containsKey("file")) {
                    String tempFilePath = files.get("file");
                    String fileName = session.getParameters().get("fileName") != null 
                        ? session.getParameters().get("fileName").get(0) 
                        : "uploaded_file";

                    File tempFile = new File(tempFilePath);
                    if (fileManager.saveFile(path, fileName, tempFile)) {
                        return newFixedLengthResponse(Response.Status.OK, "text/plain", "OK");
                    }
                }
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Erreur sauvegarde");
            } catch (Exception e) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Erreur: " + e.getMessage());
            }
        }

        // TÉLÉCHARGEMENT
        if (uri.startsWith("/download/")) {
            File file = fileManager.getFile(uri.substring("/download/".length()));
            if (file != null) {
                try {
                    InputStream is = new FileInputStream(file);
                    Response res = newChunkedResponse(Response.Status.OK, resolveMimeType(file.getName()), is);
                    res.addHeader("Content-Disposition", "attachment; filename=\"" + file.getName() + "\"");
                    return res;
                } catch (IOException ignored) {}
            }
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Fichier non trouvé");
        }

        // RESSOURCES STATIQUES (Web UI)
        String assetPath = "web" + uri;
        if ("/".equals(uri)) assetPath = "web/index.html";
        
        try {
            InputStream is = mContext.getAssets().open(assetPath);
            return newChunkedResponse(Response.Status.OK, resolveMimeType(assetPath), is);
        } catch (IOException e) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "404");
        }
    }

    private String resolveMimeType(String uri) {
        if (uri.endsWith(".html")) return "text/html";
        if (uri.endsWith(".js")) return "application/javascript";
        if (uri.endsWith(".css")) return "text/css";
        if (uri.endsWith(".png")) return "image/png";
        if (uri.endsWith(".jpg") || uri.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }
}
