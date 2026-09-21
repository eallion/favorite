import React from 'react';
import { useConfigContext } from '../../contexts/ConfigContext';

export function Footer() {
  const { ai, website } = useConfigContext();
  const currentYear = new Date().getFullYear() || 2026;

  const siteName = ai?.websiteTitle?.trim() || ai?.navigationName?.trim() || ai?.sidebarNavigationName?.trim();

  const icp = website?.icp?.trim();
  const mps = website?.mps?.trim();
  const icpUrl = website?.icpUrl?.trim() || (icp ? 'https://beian.miit.gov.cn/' : '');

  // 若未指定公安备案链接且备案文本中包含数字编码，则自动生成公安部备案平台查询链接
  const mpsRecordCode = mps ? mps.replace(/\D/g, '') : '';
  const defaultMpsUrl = mpsRecordCode
    ? `http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=${mpsRecordCode}`
    : '';
  const mpsUrl = website?.mpsUrl?.trim() || defaultMpsUrl;

  return (
    <footer className="mt-auto py-6 px-4 shrink-0 border-t border-slate-200/40 dark:border-slate-800/60">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
        <span>&copy; {currentYear}{siteName ? ` ${siteName}` : ''} All Rights Reserved.</span>

        {icp && (
          icpUrl ? (
            <a
              href={icpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline transition-colors"
            >
              {icp}
            </a>
          ) : (
            <span>{icp}</span>
          )
        )}

        {mps && (
          mpsUrl ? (
            <a
              href={mpsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 hover:underline transition-colors"
            >
              <img
                src="/mps.png"
                alt="公网安备"
                className="w-4 h-4 object-contain inline-block shrink-0"
              />
              <span>{mps}</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1">
              <img
                src="/mps.png"
                alt="公网安备"
                className="w-4 h-4 object-contain inline-block shrink-0"
              />
              <span>{mps}</span>
            </span>
          )
        )}
      </div>
    </footer>
  );
}
