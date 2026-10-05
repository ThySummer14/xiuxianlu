'use strict';
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const name of fs.readdirSync(path.join(root,'assets')).filter(n=>n.endsWith('.js'))){
  execFileSync(process.execPath,['--check',path.join(root,'assets',name)],{stdio:'inherit'});
}
const tests=fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.cjs')).map(n=>path.join(root,'tests',n));
execFileSync(process.execPath,['--test','--test-concurrency=1',...tests],{stdio:'inherit',cwd:root});
