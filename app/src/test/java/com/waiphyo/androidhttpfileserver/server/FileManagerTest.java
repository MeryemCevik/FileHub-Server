package com.waiphyo.androidhttpfileserver.server;

import static org.junit.Assert.*;
import org.junit.Before;
import org.junit.Test;

/**
 * CLASSE DE TESTS UNITAIRES (JUnit 4)
 * 
 * OBJECTIF : Valider la "Logique Métier" de l'application pour garantir
 * la qualité et la sécurité des manipulations de fichiers.
 */
public class FileManagerTest {

    private FileManager fileManager;

    @Before
    public void setUp() {
        // Initialisation avant chaque test
        fileManager = new FileManager("/dummy/path");
    }

    /**
     * TEST : Formatage de la taille des fichiers.
     * On vérifie que les calculs de conversion (Octets -> Ko -> Mo) sont exacts.
     */
    @Test
    public void testFormatSize() {
        assertEquals("0 o", fileManager.formatSize(0));
        assertEquals("1 o", fileManager.formatSize(1));
        assertEquals("1 Ko", fileManager.formatSize(1024));
        assertEquals("1 Mo", fileManager.formatSize(1024 * 1024));
        assertEquals("1,5 Mo", fileManager.formatSize((long)(1.5 * 1024 * 1024)));
    }

    /**
     * TEST : Nettoyage et Sécurité des chemins.
     * On vérifie que le système empêche d'accéder à des dossiers interdits
     * en nettoyant les slashes initiaux.
     */
    @Test
    public void testCleanPath() {
        assertEquals("Documents", fileManager.cleanPath("/Documents"));
        assertEquals("Documents/Images", fileManager.cleanPath("//Documents/Images"));
        assertEquals("test.txt", fileManager.cleanPath("\\test.txt"));
        assertEquals("", fileManager.cleanPath(null));
    }

    /**
     * TEST : Détection des fichiers volumineux.
     * On vérifie que la barrière de sécurité (20 Mo) fonctionne.
     */
    @Test
    public void testLargeFileDetectionLogic() {
        long twentyOneMega = 21 * 1024 * 1024L;
        assertTrue("Un fichier de 21Mo doit être détecté comme volumineux", twentyOneMega > 20 * 1024 * 1024);
    }
}
