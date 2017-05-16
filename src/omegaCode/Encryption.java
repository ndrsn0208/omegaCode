package omegaCode;

import java.math.BigInteger;

public class Encryption 
{
	 private String string;
     private int[][] omegaMtrx;
     private int[] keyIndexes;
     private int[] colMain;
     
     public Encryption(String s)
     {
   	    string = s;
   	    int[] col = new int[64];
   	    int[] indexList = new int[64];
     	for (int i = 0; i < 64; i++) 
     	{
			int r = (int)((Math.random() * 95) + 32);
			col[i] = r;
			int n = (int)(Math.random() * 64);
			indexList[i] = n;
		}
     	colMain = col;
     	int[][] mgMtrx = new int[64][64];
     	int[] col1 = new int[64];
     	int ind = 0;
     	for (int is : col)
     	{
			col1[ind] = is;
			ind++;
		}
     	for (int k = 0; k < mgMtrx[0].length; k++) 
     	{
			int digit = indexList[k];
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
     	keyIndexes = indexList;

     }
     
     public int[][] shuffle2D(int[][] mat, int row, int col)
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
     
     public int[] shuffle1D(int[] arry, int t)
     {
    	 int[] temp = arry;
    	 for (int i = 0; i < t; i++)
    	 {
    		 int halvLength = (arry.length) / 2;
			 if ((halvLength - ((double)(arry.length) / 2)) != 0);
			 {
				 halvLength += 1;
			 }
			 int[] part1 = new int[halvLength];
			 int[] part2 = new int[(arry.length) / 2];
			 for (int j = 0; j < part1.length; j++)
			 {
				part1[j] = temp[j * 2];
			 } 
			 for (int k = 0; k < part2.length; k++)
			 {
				part2[k] = temp[(k * 2) + 1];
			 }
			 for (int h = 0; h < part2.length; h++)
			 {
				temp[h] = part2[h];
			 }
			 for (int g = 0; g < part1.length; g++)
			 {
				temp[g + part2.length] = part1[g];
			 }
		 }
    	 return temp;
     } 
     
     public int[] toAscii(String s)
     {
   	  char[] chars = s.toCharArray();
   	  int[] ints = new int[s.length()];
   	  for (int i = 0 ; i < s.length(); i++)
   	  {
   		  ints[i] = (int)(chars[i]);
   	  }
   	  return ints;
     }
     
     public String getString()
     {
    	 return string;
     }
     
     public int[] getIndex()

     {
		return keyIndexes;
	 }
     
     public int[] encryptionMain(Encryption e)
     {
    	 int[] encryptedCode = new int[e.getString().length()];
    	 String originCode = e.getString();
    	 int[] indexes = e.getIndex();
    	 int times = e.getString().length() / 64;
    	 int rem = e.getString().length() % 64;
    	 int tempTimes = times;
    	 int[] asciiCache = toAscii(originCode);
    	 int m = 0;
    	 while(indexes[m] == 0)
    	 {
    		 m++;
    	 }
    	 int shuffleTimes = indexes[m];
    	 int[] shuffledInt = shuffle1D(asciiCache, shuffleTimes);
    	 String shuffledString = outPut(shuffledInt);
    	 String stringTemp = shuffledString;
    	 int index = 0;
    	 while(tempTimes >= 0)
    	 {
    		 if(tempTimes == 0)
    		 {
    			 int indexCol = 0;
    			 int[] asciiTemp = toAscii(stringTemp);
    			 for (int i = 0; i < rem; i++)
    			 {   				     				 
        			 int keyIndex = indexes[i];
        			 int bigger = omegaMtrx[keyIndex][indexCol];
        			 if (bigger < asciiTemp[i])
    				 {
    					 encryptedCode[index] = asciiTemp[i];
					 }
    				 else
    				 {
    					 encryptedCode[index] = (omegaMtrx[keyIndex][indexCol] % asciiTemp[i]) + 32;
    				 }				
    			     indexCol++;		
    			     index++;
				 }
    				return encryptedCode;
    		 }
    		 else
    		 {
    			 String temp = stringTemp.substring(0,64);
    			 String remString = stringTemp.substring(64);
    			 tempTimes--;
    			 int[] asciiTemp = toAscii(temp);
    			 int indexCol = 0;
    			 for (int j = 0; j < temp.length(); j++)
    			 {
    				 int keyIndex = indexes[j];
    				 int bigger = omegaMtrx[keyIndex][indexCol];
    				 if (bigger < asciiTemp[j])
    				 {
    					 encryptedCode[index] = asciiTemp[j];
					 }
    				 else
    				 {
    					 encryptedCode[index] = (omegaMtrx[keyIndex][indexCol] % asciiTemp[j]) + 32;
    				 }					
					 indexCol++;
					 index++;
				 }
    			 stringTemp = remString;
    		 }
    	 }
		return encryptedCode;
     }
     
     public String outPut(int[] encrypted)
     {
    	 String out = "";
    	 for (int i : encrypted)
    	 {
    		 out += (char)i;
		 }
		 return out;
     }
     
     public String getPrivateKey()
     {
    	 String s1 = "";
    	 for (int i : colMain)
    	 {
			s1 = s1 + i + "";
		 }
    	 BigInteger pk = new BigInteger(s1);
    	 String pk16 = pk.toString(16);
    	 return pk16;
     }
     
     public String toGeneratePack()
     {
    	 String s1 = "";
    	 for (int i : colMain)
    	 {
			s1 = s1 + i + "";
		 }
    	 String s2 = "";
    	 for (int j : keyIndexes)
    	 {
			s2 = s2 + j + ""; 
		 }
    	 BigInteger IK = new BigInteger(s2);
    	 BigInteger CK = new BigInteger(s1);
    	 BigInteger pack = IK.multiply(CK);
    	 String pack16 = pack.toString(16);
    	 return pack16;
     }
}


//4dc8885a2ba807382429f7454d7bc34f62a87bd80e94f1677859403b46015b2b433d214697a285dd5eaf8cb2af224c303a59afae8d251fe279953c62c53
//bc08b67321a4cdb283a1cf7ec3bbb07d76f2fae1c978fc822d6a1ee63030c31bdf0d1f0ff5af741e9a963a3956abbebc540e9fcf4fd87564c96f2addb24347656aafbfad6996c752cc591391a133853939b61cf01f17c069ca75baa47cde5b695c3ce316c08c2fdf453a46d1399e521
//9110970115100441245954355367908812212186338212694654598103103371075671547479997373118118107359488911161231051093262431266550117741143482811179212311257
