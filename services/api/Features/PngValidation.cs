using System.Buffers.Binary;
using System.IO.Compression;

namespace Tripora.Api.Features;
// Validate bounded, non-interlaced 8-bit RGB/RGBA PNGs produced by the mobile image adapter.
public static class PngValidation
{
    public static bool Valid(byte[] bytes, int maxEdge, int maxBytes)
    {
        if (bytes.Length > maxBytes || bytes.Length < 45 || !bytes.AsSpan(0, 8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10})) return false;
        try
        {
            var offset = 8; var width = 0; var height = 0; var channels = 0; var ended = false; var header = false;
            using var compressed = new MemoryStream();
            while (offset + 12 <= bytes.Length)
            {
                var length = checked((int)BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(offset, 4)));
                if (length < 0 || length > bytes.Length - offset - 12) return false;
                var name = System.Text.Encoding.ASCII.GetString(bytes, offset + 4, 4);
                var expectedCrc = BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(offset + 8 + length, 4));
                if (Crc(bytes.AsSpan(offset + 4, length + 4)) != expectedCrc) return false;
                if (!header && name != "IHDR") return false;
                if (name == "IHDR")
                {
                    if (header || length != 13) return false; header = true;
                    width = checked((int)BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(offset + 8, 4)));
                    height = checked((int)BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(offset + 12, 4)));
                    var color = bytes[offset + 17]; channels = color == 2 ? 3 : color == 6 ? 4 : 0;
                    if (width < 1 || height < 1 || width > maxEdge || height > maxEdge || channels == 0 || bytes[offset + 16] != 8 ||
                        bytes[offset + 18] != 0 || bytes[offset + 19] != 0 || bytes[offset + 20] != 0) return false;
                }
                else if (name == "IDAT") compressed.Write(bytes, offset + 8, length);
                else if (name == "IEND") { if (length != 0) return false; ended = true; offset += 12; break; }
                else if (name.Length != 4 || char.IsUpper(name[0])) return false;
                offset += length + 12;
            }
            if (!ended || offset != bytes.Length || compressed.Length == 0) return false;
            compressed.Position = 0;
            using var stream = new ZLibStream(compressed, CompressionMode.Decompress);
            var row = new byte[checked(width * channels)];
            for (var y = 0; y < height; y++)
            {
                var filter = stream.ReadByte(); if (filter < 0 || filter > 4) return false;
                stream.ReadExactly(row);
            }
            return stream.ReadByte() == -1;
        }
        catch (Exception error) when (error is IOException or OverflowException or ArgumentException) { return false; }
    }
    private static uint Crc(ReadOnlySpan<byte> bytes)
    {
        var crc = uint.MaxValue;
        foreach (var value in bytes) { crc ^= value; for (var bit = 0; bit < 8; bit++) crc = (crc >> 1) ^ ((crc & 1) == 0 ? 0u : 0xEDB88320u); }
        return ~crc;
    }
}
