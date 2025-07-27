/**
 *  We handle several device classes based on browser width.
 *
 *  - desktop:   > __tablet_width__ (as set in style.ini)
 *  - mobile:
 *    - tablet   <= __tablet_width__
 *    - phone    <= __phone_width__
 */
var device_class = ''; // not yet known
var device_classes = 'desktop mobile tablet phone';

function tpl_dokuwiki_mobile(){

    // the z-index in mobile.css is (mis-)used purely for detecting the screen mode here
    var screen_mode = jQuery('#screen__mode').css('z-index') + '';

    // determine our device pattern
    // TODO: consider moving into dokuwiki core
    switch (screen_mode) {
        case '1':
            if (device_class.match(/tablet/)) return;
            device_class = 'mobile tablet';
            break;
        case '2':
            if (device_class.match(/phone/)) return;
            device_class = 'mobile phone';
            break;
        default:
            if (device_class == 'desktop') return;
            device_class = 'desktop';
    }

    jQuery('html').removeClass(device_classes).addClass(device_class);

    // handle some layout changes based on change in device
    var $handle = jQuery('#dokuwiki__aside h3.toggle');
    var $toc = jQuery('#dw__toc h3');

    if (device_class == 'desktop') {
        // reset for desktop mode
        if($handle.length) {
            $handle[0].setState(1);
            $handle.hide();
        }
        if($toc.length) {
            $toc[0].setState(1);
        }
    }
    if (device_class.match(/mobile/)){
        // toc and sidebar hiding
        if($handle.length) {
            $handle.show();
            $handle[0].setState(-1);
        }
        if($toc.length) {
            $toc[0].setState(-1);
        }
    }
}

jQuery(function(){
    var resizeTimer;
    dw_page.makeToggle('#dokuwiki__aside h3.toggle','#dokuwiki__aside div.content');

    tpl_dokuwiki_mobile();
    jQuery(window).bind('resize',
        function(){
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(tpl_dokuwiki_mobile,200);
        }
    );

    // increase sidebar length to match content (desktop mode only)
    var $sidebar = jQuery('.desktop #dokuwiki__aside');
    if($sidebar.length) {
        var $content = jQuery('#dokuwiki__content div.page');
        $content.css('min-height', $sidebar.height());
    }

    var $has_subList = jQuery('.has-subList'),
        $dw_search = jQuery('#dw__search'),
        $icon_search = jQuery('.icon-search'),
        $first_heading = jQuery('.main :header').eq(0),
        $wrap_column = jQuery('.wrap_column'),
        $sidebar_title = jQuery('.sidebar-title'),
        $not_pc_navBtn = jQuery('.header-nav.not-pc .header-navButton'),
        $not_pc_nav = jQuery('.nav-for-device');

    $has_subList.click(function(){
        jQuery(this).siblings('.has-subList').find('ul').slideUp('500');
        jQuery(this).find('ul').slideToggle('500');
    });

    $has_subList.find('ul').click(function(e) {
        e.stopPropagation();
    });

    $dw_search.find('.edit').attr('placeholder', 'Google');

    $icon_search.click(function() {
        $dw_search.find('.button').click();
    });

    var isAdminMenu = $first_heading.prev().attr('href') && $first_heading.prev().attr('href').match(/http:\/\/www\.dokuwiki.org\/security/).length;
    if (! $first_heading.prev().length || isAdminMenu) {
        $first_heading.css('margin-top', 0);
    }

    $wrap_column.each(function(index) {
      if (! jQuery(this).find(':header').eq(0).prev().length) {
        jQuery(this).find(':header').eq(0).css('margin-top', 0);
      }
    });

    var reg = /^([^:]+[\w]+[^<])+([<].*)/,
        regresult = $sidebar_title.html().match(reg);
    regresult && $sidebar_title.html(regresult[1] + regresult[2]);

    $not_pc_nav.slideUp(0);
    $not_pc_navBtn.click(function() {
      jQuery(this).stop().toggleClass('is-active');
      $not_pc_nav.stop().slideToggle(500);
    })

});
