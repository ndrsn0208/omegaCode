package omegaCode;

import java.math.BigInteger;

public class Decryption
{
	private int[] indexList;
	private String encryptedMessage;
	private int[][] omegaMtrx;
	
	public Decryption(String message, String keypack, String key)
	{
		encryptedMessage = message;
		BigInteger cols = new BigInteger(key);
		BigInteger pack = new BigInteger(keypack);
		BigInteger indexes = pack.divide(cols);
		String indexesStr = indexes.toString();
		int[] col1 = new int[64];
		for (int i = 0; i < col1.length; i++)
		{
			String colIndex = key.substring(0, 2);
			String firstDigit = colIndex.substring(0, 1);
			if (Integer.parseInt(firstDigit) == 1)
			{
				col1[i] = Integer.parseInt(key.substring(0, 3));
				key = key.substring(3);
			}
			else
			{
				col1[i] = Integer.parseInt(colIndex);
				key = key.substring(2);
			}		
		}
		int[] index1 = new int[64];
		for (int j = 0; j < index1.length; j++)
		{
			String partialIndex = indexesStr.substring(0, 2);
			if (partialIndex.substring(0, 1).equals("0"))
			{
				index1[j] = Integer.parseInt(partialIndex.substring(1));
				indexesStr = indexesStr.substring(2);
			}
			else
			{
				index1[j] = Integer.parseInt(partialIndex);
				indexesStr = indexesStr.substring(2);
			}
		}
		indexList = index1;
		int[][] mgMtrx = new int[64][64];
		for (int k = 0; k < mgMtrx[0].length; k++) 
     	{
			int digit = index1[k];
			for (int l = 0; l < mgMtrx.length; l++) 
			{
				if (digit + l < 64)
				{			    
				    mgMtrx[l][k] = col1[digit+l];
				}
				else
				{
					int remainder = l+digit-64;
					mgMtrx[l][k] = col1[remainder];
				}	
			}
			for (int i = 0; i < col1.length; i++)
			{
				col1[i] = col1[i] + 1;
				if (col1[i] == 127)
				{
					col1[i] = 32;
				}
			}
		}
		omegaMtrx = mgMtrx;
	}
	
	public int[] deShuffle1D(int[] shuffled, int t)
	{
	 int[] temp = shuffled;
	 for (int time = 0; time < t; time++)
	 {
   	   int[] part1 = new int[temp.length / 2];
   	   int half = temp.length / 2;
   	     if (temp.length % 2 != 0)
   	     {
   		     half += 1;
   	     }
          int[] part2 = new int[half];
          for (int m = 0; m < part1.length; m++)
	     {
	 	    part1[m] = temp[m];
	     } 
	     for (int k = 0; k < part2.length; k++)
	     {
	   	    part2[k] = temp[k + part1.length];
	     }
    	 for (int i = 0; i < part2.length; i++)
   	     {
	        temp[i * 2] = part2[i];
	     }
     	 for (int j = 0; j < part1.length; j++)
   	     {
	        temp[j * 2 + 1] = part1[j];
	     }
	 }
   	 return temp;		 
	}
	
	public String getString()
	{
		return encryptedMessage;
	}
	
	public int[] decryptionMian(Decryption d)
	{
		int[] decryptedCode = new int[d.getString().length()];
		String encryptedMessage = d.getString();
		int times = d.getString().length() / 64;
		int rem = d.getString().length() % 64;
		int index = 0;
		while(times > -1)
		{
			if (times == 0)
			{
				times--;
				int[] eMessage = d.deToAscii(encryptedMessage);
				for (int i = 0; i < rem; i++)
				{
					if (eMessage[i] > omegaMtrx[indexList[i]][i])
					{
						decryptedCode[index] = eMessage[i];
					}
					else
					{
					decryptedCode[index] = omegaMtrx[indexList[i]][i] - (eMessage[i] - 32);
					}
					index++;
				}
			}
			if(times > 0)
			{
			 String temp = encryptedMessage.substring(0,64);
   			 String remString = encryptedMessage.substring(64);
   			 times--;
   			 int[] eMessage = deToAscii(temp);
   			 for (int j = 0; j < temp.length(); j++)
   			   {
					if (eMessage[j] > omegaMtrx[indexList[j]][j])
					{
						decryptedCode[index] = eMessage[j];
					}
					else
					{
			            decryptedCode[index] = omegaMtrx[indexList[j]][j] - (eMessage[j] - 32);
					}    
					index++;
			        
   			encryptedMessage = remString;
			  }
		    }
		 }
		 String s2 = "";
    	 for (int j : indexList)
    	 {
			s2 = s2 + j + ""; 
		 }
    	 int shuffleTimes = Integer.parseInt(s2.substring(0, 4));
    	 int[] restoredInt = deShuffle1D(decryptedCode, shuffleTimes);
		 return restoredInt;		 
	}
	
	public int[] deToAscii(String s)
	{
	   	  char[] chars = s.toCharArray();
	   	  int[] ints = new int[s.length()];
	   	  for (int i = 0 ; i < s.length(); i++)
	   	  {
	   		  ints[i] = (int)(chars[i]);
	   	  }
	   	  return ints;
	}
	
	public String outPut(int[] decrypted)
    {
   	 String out = "";
   	 for (int i : decrypted)
   	 {
   		 out += (char)i;
		 }
		 return out;
    }
	
}
