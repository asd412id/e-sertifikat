const PuppeteerPDFService = require('./services/PuppeteerPDFService.js');
const fs = require('fs').promises;

// Test template with various font weights and styles
const testTemplate = {
  width: 800,
  height: 600,
  design: {
    background: null,
    objects: [
      {
        type: 'text',
        text: 'Certificate of Achievement',
        fontFamily: 'Pacifico',
        fontSize: 32,
        fontWeight: '400',
        fontStyle: 'normal',
        x: 100,
        y: 100,
        width: 600,
        align: 'center',
        fill: '#2E86AB'
      },
      {
        type: 'text',
        text: 'This certifies that {nama}',
        fontFamily: 'Open Sans',
        fontSize: 24,
        fontWeight: '600',
        fontStyle: 'normal',
        x: 100,
        y: 200,
        width: 600,
        align: 'center',
        fill: '#333333'
      },
      {
        type: 'text',
        text: 'Has successfully completed the course at {instansi}',
        fontFamily: 'Open Sans',
        fontSize: 18,
        fontWeight: '400',
        fontStyle: 'italic',
        x: 100,
        y: 300,
        width: 600,
        align: 'center',
        fill: '#666666'
      },
      {
        type: 'text',
        text: 'Director: {direktur}',
        fontFamily: 'Avant Garde',
        fontSize: 16,
        fontWeight: 'bold',
        fontStyle: 'normal',
        x: 100,
        y: 450,
        width: 300,
        align: 'left',
        fill: '#000000'
      }
    ]
  }
};

// Test participants
const testParticipants = [
  {
    data: {
      nama: 'John Doe',
      instansi: 'Tech University',
      direktur: 'Dr. Smith'
    }
  },
  {
    data: {
      nama: 'Jane Smith',
      instansi: 'Innovation Academy',
      direktur: 'Prof. Johnson'
    }
  },
  {
    data: {
      nama: 'Bob Wilson',
      instansi: 'Digital Institute',
      direktur: 'Dr. Brown'
    }
  },
  {
    data: {
      nama: 'Alice Johnson',
      instansi: 'Learning Center',
      direktur: 'Prof. Davis'
    }
  },
  {
    data: {
      nama: 'Charlie Brown',
      instansi: 'Education Hub',
      direktur: 'Dr. Miller'
    }
  }
];

async function testBulkPDFGeneration() {
  console.log('Starting bulk PDF generation test...');
  console.log(`Template: ${testTemplate.width}x${testTemplate.height}`);
  console.log(`Participants: ${testParticipants.length}`);

  try {
    const startTime = Date.now();

    // Test bulk generation
    console.log('\n=== Testing Bulk PDF Generation ===');
    const bulkPdfBuffer = await PuppeteerPDFService.createBulkPDFFromTemplate(testTemplate, testParticipants);

    const bulkTime = Date.now() - startTime;
    console.log(`Bulk PDF generation completed in ${bulkTime}ms`);
    console.log(`Bulk PDF size: ${bulkPdfBuffer.length} bytes`);

    // Save bulk PDF
    await fs.writeFile('./test_bulk_certificates.pdf', bulkPdfBuffer);
    console.log('Bulk PDF saved as test_bulk_certificates.pdf');

    // Test individual generation for comparison
    console.log('\n=== Testing Individual PDF Generation (for comparison) ===');
    const individualStartTime = Date.now();

    for (let i = 0; i < testParticipants.length; i++) {
      const participant = testParticipants[i];
      const pdfBuffer = await PuppeteerPDFService.createPDFFromTemplate(testTemplate, participant);
      await fs.writeFile(`./test_individual_${i + 1}.pdf`, pdfBuffer);
      console.log(`Generated individual PDF ${i + 1}: ${pdfBuffer.length} bytes`);
    }

    const individualTime = Date.now() - individualStartTime;
    console.log(`Individual PDF generation completed in ${individualTime}ms`);

    console.log('\n=== Performance Comparison ===');
    console.log(`Bulk generation: ${bulkTime}ms`);
    console.log(`Individual generation: ${individualTime}ms`);
    console.log(`Performance improvement: ${Math.round((individualTime / bulkTime) * 100)}% (${Math.round(individualTime / bulkTime)}x faster)`);

    // Clean up
    await PuppeteerPDFService.close();
    console.log('\nTest completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
    await PuppeteerPDFService.close();
    process.exit(1);
  }
}

// Run the test
testBulkPDFGeneration()
  .finally(() => {
    process.exit(0);
  });
