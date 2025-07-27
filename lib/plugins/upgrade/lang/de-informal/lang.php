<?php

/**
 * @license    GPL 2 (http://www.gnu.org/licenses/gpl.html)
 * 
 * @author Thomas Templin <templin@gnuwhv.de>
 * @author rnck <dokuwiki@rnck.de>
 */
$lang['menu']                  = 'Wiki aktualisieren';
$lang['vs_php']                = 'Neue DokuWiki Versionen benötigen mindestens PHP Version %s. Du verwendest PHP Version %s. Du solltest PHP aktualisieren bevor Du DokuWiki aktualisierst.';
$lang['vs_tgzno']              = 'Die neueste Version von DokuWiki konnte nicht ermittelt werden.';
$lang['vs_tgz']                = 'DokuWiki <b>%s</b> ist zum Download verfügbar.';
$lang['vs_local']              = 'Du verwendest DokuWiki <b>%s</b>.';
$lang['vs_localno']            = 'Es ist unklar, wie alt die von Dir verwendete DokuWiki Version ist. Ein manuell Upgrade wird empfohlen.';
$lang['vs_newer']              = 'Es sieht so aus, als ob die von Dir verwendete DokuWiki Version neuer ist als die letzte stabile Version. Ein Upgrade wird nicht empfohlen.';
$lang['vs_same']               = 'Deine DokuWiki Version ist aktuell. Kein Upgrade notwendig.';
$lang['vs_plugin']             = 'Es ist eine neuere Version des Upgrade-Plugins verfügbar (%s). Du solltest das Plugin aktualisieren bevor Du fortfährst.';
$lang['vs_ssl']                = 'Dein PHP scheint SSL nicht zu unterstützen. Der Download der benötigten Daten wird vermutlich fehlschlagen. Akstualisiere stattdessen manuell.';
$lang['dl_from']               = 'Archiv wird von %s heruntergeladen...';
$lang['dl_fail']               = 'Herunterladen fehlgeschlagen.';
$lang['dl_done']               = 'Herunterladen abgeschlossen (%s).';
$lang['pk_extract']            = 'Archiv wird entpackt...';
$lang['pk_fail']               = 'Entpacken fehlgeschlagen.';
$lang['pk_done']               = 'Entpacken abgeschlossen.';
$lang['pk_version']            = 'DokuWiki <b>%s</b> ist zur Installation bereit (Du betreibst momentan <b>%s</b>).';
$lang['ck_start']              = 'Dateirechte werden &uuml;berpr&uuml;ft...';
$lang['ck_done']               = 'Alle Dateien sind beschreibbar. Zur Aktualisierung bereit.';
$lang['ck_fail']               = 'Einige Dateien sind nicht beschreibbar. Die automatische Aktualisierung ist nicht m&ouml;glich.';
$lang['cp_start']              = 'Dateien werden aktualisiert...';
$lang['cp_done']               = 'Dateien wurden aktualisiert.';
$lang['cp_fail']               = 'Autsch. Irgendetwas funktioniert nicht. &Uuml;berpr&uuml;fe es besser von Hand.';
$lang['tv_noperm']             = '<code>%s</code> ist nicht beschreibbar!';
$lang['tv_upd']                = '<code>%s</code> wird aktualisiert.';
$lang['tv_nocopy']             = 'Konnte Datei <code>%s</code> nicht kopieren!';
$lang['tv_nodir']              = 'Konnte Verzeichnis <code>%s</code> nicht erstellen!';
$lang['tv_done']               = '<code>%s</code> wurde aktualisiert.';
$lang['rm_done']               = 'Veraltete <code>%s</code> wurde gel&ouml;scht.';
$lang['rm_fail']               = 'Konnte veraltete Datei <code>%s</code> nicht l&ouml;schen. <b>Bitte l&ouml;schen Sie von Hand!</b>';
$lang['finish']                = 'Aktualisierung abgeschlossen. Genie&szlig;en Sie Ihr neues DokuWiki!';
$lang['btn_continue']          = 'Fortsetzen';
$lang['btn_abort']             = 'Abbrechen';
$lang['step_version']          = 'Prüfen';
$lang['step_download']         = 'Herunterladen';
$lang['step_unpack']           = 'Entpacken';
$lang['step_check']            = 'Verifizieren';
$lang['step_upgrade']          = 'Installieren';
