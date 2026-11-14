$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$data = Join-Path $project 'data'
New-Item -ItemType Directory -Force -Path $data | Out-Null

$coat = 'https://huggingface.co/datasets/RussianNLP/coat/resolve/a2698e9e441144d39bedbc1d5812bb6351102d06/binary'
$aina = 'https://huggingface.co/datasets/ajnasiou/aina-kk/resolve/099d41d8a893071227603c0025b29ccc640a6fbb/data'
$ru = 'https://raw.githubusercontent.com/CoffeBank/Ru-hard-detection-dataset/2d6477427de88ec8ad86698917fe16f49a556b81/main/essay'
$files = @{
  'en-essay.parquet' = 'https://huggingface.co/datasets/acmc/ghostbuster_essay/resolve/46156ee2984b883a9506275ef52227af2a2e54b0/data/train-00000-of-00001.parquet'
  'en-hc3.jsonl' = 'https://huggingface.co/datasets/Hello-SimpleAI/HC3/resolve/4d0ff18143b5a7e1b1e79beb540c04549d1e59d3/open_qa.jsonl'
  'ru-train.parquet' = "$coat/train-00000-of-00001.parquet"
  'ru-validation.parquet' = "$coat/validation-00000-of-00001.parquet"
  'ru-generated_essays.json' = "$ru/generated_essays.json"
  'ru-original_essay.json' = "$ru/original_essay.json"
  'ru-paraphrased_essays.json' = "$ru/paraphrased_essays.json"
  'aina-human.jsonl' = "$aina/human.jsonl"
  'aina-machine.jsonl' = "$aina/machine.jsonl"
  'NotoSans-Regular.ttf' = 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf'
  'OFL.txt' = 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/LICENSE'
}

foreach ($file in $files.GetEnumerator() | Sort-Object Key) {
  $target = Join-Path $data $file.Key
  if (Test-Path -LiteralPath $target) { continue }
  Write-Host "Fetching $($file.Key)"
  $tempFile = "$target.download"
  curl.exe -fsSL --retry 2 --max-time 400 $file.Value -o $tempFile
  if ($LASTEXITCODE) { throw "Download failed: $($file.Key)" }
  Move-Item -LiteralPath $tempFile -Destination $target
}

