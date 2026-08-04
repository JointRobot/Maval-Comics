const { execFileSync } = require('child_process');
const path = require('path');

// electron-builder skips code signing entirely when no Developer ID
// certificate is configured (that's the case in this CI pipeline). On
// Apple Silicon, macOS refuses to launch a completely unsigned binary
// ("...may be damaged or incomplete") — it requires at least an ad-hoc
// signature. Applying one here, before the app gets packed into the
// dmg/zip, makes the shipped build launch with no manual steps.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  console.log(`Ad-hoc signed ${appPath}`);
};
