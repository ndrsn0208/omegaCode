import omegaCode.Encryption;
import omegaCode.Decryption;

/** Generate fixtures by executing the untouched 2017 classes. */
public class OmegaReference {
    private static String units(String value) {
        StringBuilder result = new StringBuilder("[");
        for (int i = 0; i < value.length(); i++) {
            if (i > 0) result.append(',');
            result.append((int) value.charAt(i));
        }
        return result.append(']').toString();
    }

    public static void main(String[] args) {
        String printable = "";
        for (int i = 32; i <= 126; i++) printable += (char) i;
        String[] names = {
            "empty", "single", "odd-length", "even-length", "63-unit boundary",
            "64-unit boundary", "65-unit boundary", "all printable ASCII",
            "Chinese", "emoji UTF-16", "legacy control-character defect"
        };
        String[] texts = {
            "", "A", "ABCDE", "ABCDEF", "x".repeat(63), "y".repeat(64),
            "z".repeat(65), printable, "\u4f60\u597d\uff0c\u4e16\u754c",
            "Omega \uD83D\uDC0D\uD83D\uDD10!", "A\tB\nC"
        };
        System.out.println("[");
        for (int i = 0; i < texts.length; i++) {
            Encryption encoder = new Encryption(texts[i]);
            String encrypted = encoder.outPut(encoder.encryptionMain(encoder));
            String privateKey = encoder.getPrivateKey();
            String keyPack = encoder.toGeneratePack();
            Decryption decoder = new Decryption(encrypted, keyPack, privateKey);
            String decrypted = decoder.outPut(decoder.decryptionMian(decoder));
            if (i > 0) System.out.println(",");
            System.out.print("{\"name\":\"" + names[i] + "\",\"input\":" + units(texts[i])
                + ",\"encrypted\":" + units(encrypted) + ",\"decrypted\":" + units(decrypted)
                + ",\"privateKey\":\"" + privateKey + "\",\"keyPack\":\"" + keyPack + "\"}");
        }
        System.out.println("\n]");
    }
}
