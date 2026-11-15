"""Refresh the pinned JMdict extract, then require a normal build/review.

Usage: python3 scripts/update-vocabulary-source.py --release latest
       python3 scripts/update-vocabulary-source.py --release 3.6.2+20261109214828
Uses Python's standard library only. Never changes source sense selections.
"""
import argparse
import hashlib
import io
import json
import pathlib
import urllib.parse
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "vocabulary"


def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Japanese-JSON-vocabulary-builder"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", required=True)
    args = parser.parse_args()
    suffix = "latest" if args.release == "latest" else "tags/" + urllib.parse.quote(args.release, safe="")
    release = json.loads(download("https://api.github.com/repos/scriptin/jmdict-simplified/releases/" + suffix))
    tag = release["tag_name"]
    asset = next(a for a in release["assets"] if a["name"].startswith("jmdict-eng-common-") and a["name"].endswith(".json.zip"))
    archive = download(asset["browser_download_url"])
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        filename = next(name for name in z.namelist() if name.endswith(".json"))
        payload = z.read(filename)
    source = json.loads(payload)
    by_id = {e["id"]: e for e in source["words"]}
    selections = json.loads((DATA / "source-selections.json").read_text())
    for slug, selection in selections.items():
        entry = by_id.get(selection["entryId"])
        if not entry or selection["senseIndex"] >= len(entry["sense"]):
            raise SystemExit(f"Source entry/sense missing for {slug}; review selections before updating.")
        glosses = [g["text"] for g in entry["sense"][selection["senseIndex"]]["gloss"]]
        if glosses != selection["glosses"]:
            raise SystemExit(f"Sense changed for {slug}: {glosses!r}. Review and update its source selection before retrying.")
    selected = encode({"snapshot": tag, "entries": [by_id[k] for k in sorted({s["entryId"] for s in selections.values()})]})
    manifest = json.loads((DATA / "source-manifest.json").read_text())
    manifest.update({
        "snapshot": tag,
        "downloadUrl": asset["browser_download_url"],
        "archiveSha256": hashlib.sha256(archive).hexdigest(),
        "jsonSha256": hashlib.sha256(payload).hexdigest(),
        "dictionaryDate": source["dictDate"],
        "selectedEntriesSha256": hashlib.sha256(selected).hexdigest(),
    })
    license_data = download(manifest["licenseUrl"])
    # Network and source-sense checks finish before replacing tracked files.
    (DATA / "source-entries.json").write_bytes(selected)
    (DATA / "source-manifest.json").write_bytes(encode(manifest))
    (DATA / "EDRDG-LICENSE.html").write_bytes(license_data)
    print(f"Updated dictionary extract to {tag}. Run npm run build:vocabulary and npm test; review the diff.")


if __name__ == "__main__":
    main()
