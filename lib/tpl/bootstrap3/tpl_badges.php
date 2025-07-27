<?php
/**
 * DokuWiki Bootstrap3 Template: Badges
 *
 * @link     http://dokuwiki.org/template:bootstrap3
 * @author   Giuseppe Di Terlizzi <giuseppe.diterlizzi@gmail.com>
 * @license  GPL 2 (http://www.gnu.org/licenses/gpl.html)
 */

// must be run from within DokuWiki
if (!defined('DOKU_INC')) die();

if (bootstrap3_conf('showBadges')):

  $target  = ($conf['target']['extern']) ? 'target="'.$conf['target']['extern'].'"' : '';
  $dw_path = dirname(tpl_basedir());

?>
<div class="text-center hidden-print">
<p style="font-family: Tahoma; font-size:11.5px; color:#888; margin:15px auto;">
&copy; <?php echo date('Y'); ?>. Powered by <a href="https://www.dokuwiki.org" target="_blank">Dokuwiki</a> / Theme by <a href="https://www.dokuwiki.org/template:bootstrap3" target="_blank">Giuseppe Di Terlizzi</a> / Designed by <a href="http://eallion.com" target="_blank">eallion</a> Ver3.1.2 / <a href="http://s.eallion.com/old" target="_blank">Old</a> | MyIP：<a href="https://www.baidu.com/s?wd=<?php
$ip = $_SERVER["REMOTE_ADDR"];
echo $ip;?>" target="_blank"><?php
$ip = $_SERVER["REMOTE_ADDR"];
echo $ip;?></a> / <a href="https://github.com/racaljk/hosts" target="_blank">hosts</a> / <a href="http://my.yizhihongxing.com/aff.php?aff=2106" target="_blank">Shadowsocks</a><br />
</p>
</div>
<?php endif; ?>
