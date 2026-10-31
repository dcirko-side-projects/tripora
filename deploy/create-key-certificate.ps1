# Creates a self-signed certificate solely to encrypt Data Protection keys at rest.
# This is not a web TLS certificate. Preserve it with the database backup.
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../local-data/hosted-beta'))
New-Item -ItemType Directory -Path $root -Force | Out-Null
$pfxPath = Join-Path $root 'key-encryption.pfx'
if (Test-Path -LiteralPath $pfxPath) { throw 'Certificate already exists; never overwrite a deployed key encryption certificate.' }
$rsa = [Security.Cryptography.RSA]::Create(3072)
$request = [Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=Tripora Key Encryption', $rsa, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
$certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5), [DateTimeOffset]::UtcNow.AddYears(5))
$passwordBytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$password = [Convert]::ToBase64String($passwordBytes)
$pfx = $certificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)
[IO.File]::WriteAllBytes($pfxPath, $pfx)
[IO.File]::WriteAllText((Join-Path $root 'key-certificate-base64.txt'), [Convert]::ToBase64String($pfx))
[IO.File]::WriteAllText((Join-Path $root 'key-certificate-password.txt'), $password)
$certificate.Dispose(); $rsa.Dispose()
Write-Output 'Private certificate and dashboard values saved under ignored local-data/hosted-beta. Keep them private and back them up; no secret printed.'
