package omegaCode;

import java.util.Scanner;

public class app
{
	public static void main(String args[])
	{
		int c = 3;
		while(c > 0)
		{
			System.out.println("1. Decryption  2. Encryption  Q. Quit");			
			Scanner in = new Scanner(System.in);
			String ins = null;
			ins = in.nextLine();
			if (ins.equals("1")) 
			{
				System.out.println("Please input the message: ");
				Scanner code = new Scanner(System.in);
				String codeString = null;
				codeString = code.nextLine();
				System.out.println("Please input the key pack: ");
				Scanner pack = new Scanner(System.in);
				String packString = null;
				packString = pack.nextLine();
				System.out.println("Please input the private key: ");
				Scanner key = new Scanner(System.in);
				String keyString = null;
				keyString = key.nextLine();
				Decryption decryption = new Decryption(codeString, packString, keyString);
				int[] temp = decryption.decryptionMian(decryption);
				System.out.println("=================================================================");
				System.out.println("Decrypted Message is: " + decryption.outPut(temp));
				System.out.println("=================================================================");
			}
			if (ins.equals("2")) 
			{
				System.out.println("Please input the message: ");
				Scanner mescode = new Scanner(System.in);
				String message = null;
				message = mescode.nextLine();
				Encryption encryption = new Encryption(message);
				int[] temp = encryption.encryptionMain(encryption);
				System.out.println("Your message is: " + encryption.getString());
				System.out.println("=================================================================");
				System.out.println("Your key pack is: " + encryption.toGeneratePack());
				System.out.println("Your PRIVATE KEY is: " + encryption.getPrivateKey());
				System.out.println("=================================================================");
				System.out.println("Your Encrypted message is: " + encryption.outPut(temp));
			}
			if (ins.equals("Q")) 
			{
				c = 0;
			}
			else
			{
				c = 3;
			}
		}
		
			
	}	
		
}
