package com.waiphyo.androidhttpfileserver.server;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipOutputStream;

import fi.iki.elonen.NanoHTTPD;

/**
 * Serveur HTTP minimaliste.
 * Gère les requêtes API, le téléchargement et l'upload de fichiers.
 */
public class HttpServer extends NanoHTTPD {
    private static final String TAG = "HttpServer";
    private final Context mContext;
    private final FileManager fileManager;

    public HttpServer(Context context, int port, String rootPath) {
        super(port);
        this.mContext = context;
        this.fileManager = new FileManager(rootPath);
        
        // Configuration du dossier temporaire pour l'upload sur Android
        setTempFileManagerFactory(new TempFileManagerFactory() {
            @Override
            public TempFileManager create() {
                return new DefaultTempFileManager() {
                    @Override
                    public void clear() {
                        super.clear();
                    }
                };
            }
        });
        
        // Force l'utilisation du dossier cache de l'app pour les fichiers temporaires
        System.setProperty("java.io.tmpdir", context.getCacheDir().getAbsolutePath());
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        Method method = session.getMethod();
        Log.d(TAG, "Requête: " + method + " " + uri);

        try {
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
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Erreur suppression");
            }

            if ("/api/mkdir".equals(uri)) {
                String parent = session.getParameters().get("parentPath") != null ? session.getParameters().get("parentPath").get(0) : "";
                String name = session.getParameters().get("name") != null ? session.getParameters().get("name").get(0) : "";
                if (fileManager.makeDirectory(parent, name)) {
                    return newFixedLengthResponse(Response.Status.OK, "text/plain", "OK");
                }
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Erreur création dossier");
            }

            if ("/api/rename".equals(uri)) {
                String oldPath = session.getParameters().get("old") != null ? session.getParameters().get("old").get(0) : "";
                String newName = session.getParameters().get("new") != null ? session.getParameters().get("new").get(0) : "";
                
                if (oldPath.isEmpty() || newName.isEmpty()) {
                    return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "Paramètres manquants");
                }
                
                if (fileManager.renameItem(oldPath, newName)) {
                    return newFixedLengthResponse(Response.Status.OK, "text/plain", "OK");
                } else {
                    return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Erreur renommage: le nouveau nom existe peut-être déjà");
                }
            }

            if ("/api/zip".equals(uri)) {
                List<String> paths = session.getParameters().get("paths");
                if (paths == null || paths.isEmpty()) {
                    return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "Aucun fichier sélectionné");
                }

                PipedInputStream pis = new PipedInputStream();
                final PipedOutputStream pos = new PipedOutputStream(pis);

                new Thread(() -> {
                    try (ZipOutputStream zos = new ZipOutputStream(pos)) {
                        fileManager.createZip(paths, zos);
                    } catch (IOException e) {
                        Log.e(TAG, "Erreur lors de la création du ZIP", e);
                    }
                }).start();

                Response res = newChunkedResponse(Response.Status.OK, "application/zip", pis);
                res.addHeader("Content-Disposition", "attachment; filename=\"archive_filehub.zip\"");
                return res;
            }

            // GESTION DE L'UPLOAD
            if ("/api/upload".equals(uri) && method == Method.POST) {
                Log.d(TAG, "Début de l'upload...");
                Map<String, String> files = new HashMap<>();
                
                // parseBody est crucial pour récupérer le fichier multipart
                session.parseBody(files);
                
                String path = session.getParameters().get("path") != null ? session.getParameters().get("path").get(0) : "";
                String fileName = session.getParameters().get("fileName") != null ? session.getParameters().get("fileName").get(0) : "file";

                if (files.containsKey("file")) {
                    String tempFilePath = files.get("file");
                    File tempFile = new File(tempFilePath);
                    
                    Log.d(TAG, "Fichier temporaire reçu: " + tempFilePath + " pour destination: " + path);
                    
                    if (fileManager.saveFile(path, fileName, tempFile)) {
                        Log.d(TAG, "Upload réussi !");
                        return newFixedLengthResponse(Response.Status.OK, "text/plain", "OK");
                    } else {
                        return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Échec de la sauvegarde (Espace insuffisant, nom invalide ou erreur système)");
                    }
                }
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Aucun fichier reçu");
            }

            // TÉLÉCHARGEMENT
            if (uri.startsWith("/download/")) {
                File file = fileManager.getFile(uri.substring("/download/".length()));
                if (file != null) {
                    InputStream is = new FileInputStream(file);
                    Response res = newChunkedResponse(Response.Status.OK, resolveMimeType(file.getName()), is);
                    res.addHeader("Content-Disposition", "attachment; filename=\"" + file.getName() + "\"");
                    return res;
                }
                return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Fichier non trouvé");
            }

            // RESSOURCES STATIQUES (Interface Web)
            String assetPath = "web" + uri;
            if ("/".equals(uri)) assetPath = "web/index.html";
            
            try {
                InputStream is = mContext.getAssets().open(assetPath);
                return newChunkedResponse(Response.Status.OK, resolveMimeType(assetPath), is);
            } catch (IOException e) {
                return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "404 - Non trouvé");
            }

        } catch (Exception e) {
            Log.e(TAG, "Erreur serveur: ", e);
            return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Erreur interne: " + e.getMessage());
        }
    }

    private String resolveMimeType(String uri) {
        String lower = uri.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".pdf")) return "application/pdf";
        return "application/octet-stream";
    }
}
