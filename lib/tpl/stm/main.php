<?php
/**
 * STM - Something That Matters 2016
 *
 * @link     https://github.com/Fraina/STM-Dokuwiki-Template
 * @author   Fraina <jscaem@gmail.com>
 * @license  GPL 2 (http://www.gnu.org/licenses/gpl.html)
 *
 * ------------------------------------------------------------------------------------
 *
 * Edit From:
 * DokuWiki Default Template 2012
 *
 * @link     http://dokuwiki.org/template
 * @author   Anika Henke <anika@selfthinker.org>
 * @author   Clarence Lee <clarencedglee@gmail.com>
 * @license  GPL 2 (http://www.gnu.org/licenses/gpl.html)
 */

if (!defined('DOKU_INC')) die(); /* must be run from within DokuWiki */
header('X-UA-Compatible: IE=edge,chrome=1');

$hasSidebar = page_findnearest($conf['sidebar']);
$showSidebar = $hasSidebar && ($ACT=='show');
?><!DOCTYPE html>
<html lang="<?php echo $conf['lang'] ?>" dir="<?php echo $lang['direction'] ?>" class="no-js">
<head>
    <meta charset="utf-8" />
    <title>蜗牛个人导航</title>
    <script>(function(H){H.className=H.className.replace(/\bno-js\b/,'js')})(document.documentElement)</script>
    <?php tpl_metaheaders() ?>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php echo tpl_favicon(array('favicon', 'mobile')) ?>
    <?php tpl_includeFile('meta.html') ?>
</head>

<body class="dokuwiki">
    <!--[if lte IE 7 ]><div id="IE7"><![endif]--><!--[if IE 8 ]><div id="IE8"><![endif]-->

    <div class="wrapper">
        <?php
            // render the content into buffer for later use
            ob_start();
            tpl_content(false);
            $buffer = ob_get_clean();
        ?>
        <?php include('tpl_header.php') ?>

        <div class="wrapper-content">
            <div class="main fr">
                <?php echo $buffer?>
            </div>
        </div>
    </div>

    <?php include('tpl_footer.php') ?>
    <!--[if ( lte IE 7 | IE 8 ) ]></div><![endif]-->
</body>
</html>
