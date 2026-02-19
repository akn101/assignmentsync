import { useState, useRef } from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  useColorMode,
  useColorModeValue,
  IconButton,
  Heading,
  Card,
  CardBody,
  useToast,
  Progress,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Flex,
  Divider,
} from '@chakra-ui/react';
import { SunIcon, MoonIcon, DownloadIcon, AttachmentIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';
import Head from 'next/head';
import * as XLSX from 'xlsx';

const MotionBox = motion(Box);
const MotionCard = motion(Card);

export default function Home() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [timetableData, setTimetableData] = useState(null);
  const fileInputRef = useRef(null);
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();

  const bgGradient = useColorModeValue('linear(to-r, #7928CA, #FF0080)', 'linear(to-r, #667eea, #764ba2)');
  const cardBg = useColorModeValue('white', 'gray.700');
  const iconColor = useColorModeValue('gray.700', 'gray.200');

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        toast({
          title: 'File selected',
          description: `${selectedFile.name} is ready to upload`,
          status: 'info',
          duration: 3000,
          isClosable: true,
          position: 'bottom',
        });
      } else {
        toast({
          title: 'Invalid file type',
          description: 'Please select an Excel file (.xlsx or .xls)',
          status: 'error',
          duration: 3000,
          isClosable: true,
          position: 'bottom',
        });
      }
    }
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a timetable file first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
        position: 'bottom',
      });
      return;
    }

    setUploading(true);

    try {
      // Parse Excel file
      const parsedData = await parseExcelFile(file);

      // Upload to Supabase
      const response = await fetch('/api/upload-timetable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          data: parsedData,
          userId: 'user-' + Date.now(), // Replace with actual user ID
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setTimetableData(parsedData);
        toast({
          title: 'Upload successful',
          description: `${file.name} has been uploaded to the database`,
          status: 'success',
          duration: 5000,
          isClosable: true,
          position: 'bottom',
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Head>
        <title>AssignmentSync - Timetable Manager</title>
        <meta name="description" content="Upload and manage your timetables" />
      </Head>

      <Box minH="100vh" py={8}>
        {/* Header */}
        <MotionBox
          position="fixed"
          top={0}
          left={0}
          w="100%"
          py={4}
          px={[4, 6, 8]}
          bg={useColorModeValue('rgba(255, 255, 255, 0.7)', 'rgba(26, 32, 44, 0.7)')}
          backdropFilter="blur(10px)"
          zIndex="900"
          initial={{ y: -100 }}
          animate={{ y: 0 }}
        >
          <Flex justifyContent="space-between" alignItems="center">
            <Text
              fontSize={['2xl', '3xl', '4xl']}
              fontWeight="bold"
              bgGradient={bgGradient}
              bgClip="text"
              className="gradient-text-no-transition"
              sx={{
                transition: 'none !important',
                WebkitTextFillColor: 'transparent !important',
              }}
            >
              AssignmentSync
            </Text>

            <IconButton
              icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
              onClick={toggleColorMode}
              variant="ghost"
              colorScheme="gray"
              size="sm"
              aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
              color={iconColor}
              _hover={{ bg: 'orange.500', color: 'white' }}
              transition="all 0.2s"
            />
          </Flex>
        </MotionBox>

        {/* Main Content */}
        <Container maxW="container.xl" pt={24}>
          <VStack spacing={8} align="stretch">
            {/* Upload Card */}
            <MotionCard
              bg={cardBg}
              boxShadow="xl"
              borderRadius="2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <CardBody p={8}>
                <VStack spacing={6} align="stretch">
                  <Box>
                    <Heading size="lg" mb={2} bgGradient={bgGradient} bgClip="text">
                      Upload Timetable
                    </Heading>
                    <Text color="gray.500" fontSize="md">
                      Upload your Excel timetable file to sync with the database
                    </Text>
                  </Box>

                  <Divider />

                  <VStack spacing={4}>
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      display="none"
                    />

                    <HStack spacing={4} w="full">
                      <Button
                        leftIcon={<AttachmentIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        colorScheme="purple"
                        variant="outline"
                        size="lg"
                        flex={1}
                      >
                        Select File
                      </Button>

                      <Button
                        leftIcon={<DownloadIcon />}
                        onClick={handleUpload}
                        colorScheme="purple"
                        size="lg"
                        flex={1}
                        isLoading={uploading}
                        isDisabled={!file}
                      >
                        Upload to Database
                      </Button>
                    </HStack>

                    {file && (
                      <HStack
                        w="full"
                        p={4}
                        bg={useColorModeValue('purple.50', 'purple.900')}
                        borderRadius="lg"
                        justify="space-between"
                      >
                        <Text fontWeight="medium">{file.name}</Text>
                        <Badge colorScheme="purple" fontSize="sm">
                          {(file.size / 1024).toFixed(2)} KB
                        </Badge>
                      </HStack>
                    )}

                    {uploading && <Progress size="xs" isIndeterminate colorScheme="purple" w="full" />}
                  </VStack>
                </VStack>
              </CardBody>
            </MotionCard>

            {/* Timetable Preview */}
            {timetableData && timetableData.length > 0 && (
              <MotionCard
                bg={cardBg}
                boxShadow="xl"
                borderRadius="2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <CardBody p={8}>
                  <VStack spacing={6} align="stretch">
                    <Box>
                      <Heading size="lg" mb={2} bgGradient={bgGradient} bgClip="text">
                        Timetable Preview
                      </Heading>
                      <Text color="gray.500" fontSize="md">
                        Showing {timetableData.length} entries
                      </Text>
                    </Box>

                    <Divider />

                    <Box overflowX="auto">
                      <Table variant="simple" size="md">
                        <Thead>
                          <Tr>
                            {Object.keys(timetableData[0]).map((key) => (
                              <Th key={key}>{key}</Th>
                            ))}
                          </Tr>
                        </Thead>
                        <Tbody>
                          {timetableData.slice(0, 10).map((row, idx) => (
                            <Tr key={idx}>
                              {Object.values(row).map((value, cellIdx) => (
                                <Td key={cellIdx}>{String(value)}</Td>
                              ))}
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                      {timetableData.length > 10 && (
                        <Text mt={4} color="gray.500" textAlign="center" fontSize="sm">
                          Showing first 10 of {timetableData.length} entries
                        </Text>
                      )}
                    </Box>
                  </VStack>
                </CardBody>
              </MotionCard>
            )}
          </VStack>
        </Container>
      </Box>
    </>
  );
}
