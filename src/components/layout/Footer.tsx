import React from 'react';
import { useConfigContext } from '../../contexts/ConfigContext';

export function Footer() {
  const { ai, website } = useConfigContext();
  const currentYear = new Date().getFullYear() || 2026;

  const siteName = ai?.websiteTitle?.trim() || ai?.navigationName?.trim() || ai?.sidebarNavigationName?.trim();

  const icp = website?.icp?.trim();
  const mps = website?.mps?.trim();

  // 提取公安备案号中的数字编码，生成新版公安部备案平台查询链接 (beian.mps.gov.cn)
  const mpsRecordCode = mps ? mps.replace(/\D/g, '') : '';
  const mpsUrl = mpsRecordCode
    ? `https://beian.mps.gov.cn/#/query/webSearch?code=${mpsRecordCode}`
    : '';

  return (
    <footer className="mt-auto py-6 px-4 shrink-0 border-t border-slate-200/40 dark:border-slate-800/60">
      <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2 text-xs text-slate-400 dark:text-slate-500 leading-normal">
        <span>&copy; {currentYear}{siteName ? ` ${siteName}` : ''} All Rights Reserved.</span>

        {icp && (
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline transition-colors"
          >
            {icp}
          </a>
        )}

        {mps && (
          mpsUrl ? (
            <a
              href={mpsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline transition-colors"
            >
              <img
                src="/mps.png"
                alt="公网安备"
                className="w-4 h-4 inline-block mr-1 align-[-3px] shrink-0"
              />
              <span>{mps}</span>
            </a>
          ) : (
            <span>
              <img
                src="/mps.png"
                alt="公网安备"
                className="w-4 h-4 inline-block mr-1 align-[-3px] shrink-0"
              />
              <span>{mps}</span>
            </span>
          )
        )}
      </div>
    </footer>
  );
}
