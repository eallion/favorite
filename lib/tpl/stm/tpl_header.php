<?php
/**
 * Template header, included in the main and detail files
 */

// must be run from within DokuWiki
if (!defined('DOKU_INC')) die();
?>

<!-- ********** HEADER ********** -->
<header class="header">
    <div class="header-content" >
        <hgroup class="header-heading fl">
            <h1 class="header-title prs">
                <a href="/"  accesskey="h" title=""><span>蜗牛个人导航</span></a>            </h1>
            <h5 class="header-subTitle tsi">简单安全的互联网入口</h5>
        </hgroup>
        <div class="header-nav fr pc-only">
            <div class="header-navButton--menuTools has-subList">
                <a class="icon-cube"></a>
                <ul>
                    <?php
                            tpl_action('edit', 1, 'li');     /* �s�譶�� */
                    ?>
                </ul>
            </div>
            <div class="header-navButton--userTools has-subList">
                <a class="icon-user"></a>
                <ul>
                    <?php
                        if (!empty($_SERVER['REMOTE_USER'])) {
                            echo '<li class="user">';
                            tpl_userinfo(); /* 'Logged in as ...' */
                            echo '</li>';
                        }
                        tpl_action('admin', 1, 'li');    /* �޲z���� */
                        tpl_action('profile', 1, 'li');  /* ���s�ӤH���� */
                        tpl_action('register', 1, 'li'); /* ���U(�p�G���}��?) */
                        tpl_action('login', 1, 'li');    /* �n�X */
                    ?>
                </ul>
            </div>
            <div class="header-navButton--searchBar">
    <form action="https://google.com/search" accept-charset="utf-8" class="search" id="dw__search" method="get" role="search" target="_blank">
	<div class="no">
		<input type="hidden" name="tn" value="favoratewiki" />
		<input type="text" placeholder="Google" id="qsearch__in" accesskey="f" name="q" class="edit" />
		<button type="submit" title="Google">搜索</button>
	</div>
    </form>  
                <a class="icon-search"></a>
            </div>
        </div>
        <div class="header-nav fr not-pc">
          <div class="header-navButton">
            <a class="icon-cube"></a>
          </div>
      </div>
    </div>
</header>

<div class="nav-for-device">
  <div class="header-navButton--searchBar">
    <form action="https://getgoogle.org/search" accept-charset="utf-8" class="search" id="dw__search" method="get" role="search" target="_blank">
	<div class="no">
		<input type="hidden" name="tn" value="favoratewiki" />
		<input type="text" placeholder="Google" id="qsearch__in" accesskey="f" name="q" class="edit" />
		<button type="submit" title="Google">搜索</button>
	</div>
    </form>
      <a class="icon-search"></a>
  </div>
  <ul>
    <?php
            tpl_action('edit', 1, 'li');     /* �s�譶�� */
    ?>
    <?php
        if (!empty($_SERVER['REMOTE_USER'])) {
            echo '<li class="user">';
            tpl_userinfo(); /* 'Logged in as ...' */
            echo '</li>';
        }
        tpl_action('admin', 1, 'li');    /* �޲z���� */
        tpl_action('profile', 1, 'li');  /* ���s�ӤH���� */
        tpl_action('register', 1, 'li'); /* ���U(�p�G���}��?) */
        tpl_action('login', 1, 'li');    /* �n�X */
    ?>
  </ul>
</div>
