package omegaCode;

import java.math.BigInteger;

public class Encryption 
{
	 private String string;
     private int[][] omegaMtrx;
     private int[] keyNums;
     private BigInteger keyPack;
     
     public Encryption(String s)
     {
   	    string = s;
   	    keyPack = BigInteger.valueOf(0);
   	    int[] col1 = new int[64];
   	    int[] numList = new int[64];
     	for (int i = 0; i < 64; i++) 
     	{
			int r = (int)((Math.random() * 95) + 32);
			col1[i] = r;
			int n = (int)(Math.random() * 10);
			numList[i] = n;
		}
     	int[][] mgMtrx = new int[64][64];
     	for (int k = 0; k < mgMtrx[0].length; k++) 
     	{
			for (int l = 0; l < mgMtrx.length; l++) 
			{
				int digit = numList[k];
				if (l+digit<64)
				{			    
				    mgMtrx[l][k] = col1[l+digit];
				}
				else
				{
					int remainder = l+digit-128;
					mgMtrx[l][k] = col1[remainder];
				}	
			}
		}
     	omegaMtrx = mgMtrx;
     	keyNums = numList;
     }
     
     public int[][] shuffle(int[][] mat, int row, int col)
     {
    	 int[][] temp = new int[mat.length][mat[0].length];
    	 int indexR = row;
 	     int indexI = 0;
	 	 int indexC = col;
 	     while (indexI < mat.length)
 	     {

 	 	     int indexJ = 0;
 	    	 while(indexJ < mat[0].length)
 	    	 {
 	    	 temp[indexR][indexC] = mat[indexI][indexJ];
 	    	 indexJ++;
 	    	 indexC++;
 	    	 if (indexC == mat[0].length)
 	    	    {
				   indexC = 0;
				   indexR++;
			    }
 	    	 if (indexR == mat.length)
 	    	    {
                   indexR = 0;
			    } 
 	    	 }
 	    	 indexI++;
 	     }
 	     return temp;
     }
     
     public int[] toAscii()
     {
   	  char[] chars = string.toCharArray();
   	  int[] ints = new int[string.length()];
   	  for (int i = 0 ; i < string.length(); i++)
   	  {
   		  ints[i] = (int)(chars[i]);
   	  }
   	  return ints;
     }
     
     public String getString()
     {
    	 return string;
     }
     
     public int[] encryptionMain(Encryption e)
     {
    	 int[] asciiNums = e.toAscii();
    	 int index = 0;
    	 while (index < e.getString().length())
    	{
    		 
		}
     }
}
