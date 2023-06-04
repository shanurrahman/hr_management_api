import { Inject, Injectable, Logger } from '@nestjs/common';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { VectorDBClient } from 'src/db-utils/vector-db-client.interface';
import { CreateIndexDTO } from './dto/create-index.dto';
import { FileParserDto } from 'src/completion/dto/payload.dto';

@Injectable()
export class DocumentIngestionService {
  constructor(
    @Inject('VECTOR_DB_CLIENT') private readonly vectorDbClient: VectorDBClient,
  ) {}
  private logger = new Logger(DocumentIngestionService.name);

  async run(options: CreateIndexDTO) {
    try {
      const { directoryPath } = options;

      /*load raw docs from all files in the directory */
      const directoryLoader = new DirectoryLoader(directoryPath, {
        '.pdf': (path) => new PDFLoader(path),
      });

      const rawDocs = await directoryLoader.load();

      /* Split text into chunks */
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const docs = await textSplitter.splitDocuments(rawDocs);
      this.logger.log('split docs', docs);

      this.logger.log('creating vector store...');

      this.vectorDbClient.embedDocuments({
        docs,
        vectorIndexName: process.env.PINECONE_INDEX_NAME,
        vectorNamespace: 'masterData',
      });

      this.logger.log('ingestion complete');

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to ingest your data', error);
      throw new Error('Failed to ingest your data');
    }
  }

  async ingestUserDocuments(file: Express.Multer.File, body: FileParserDto) {
    const loader = new PDFLoader(file.path, { splitPages: true });
    const rawDocs = await loader.load();

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      keepSeparator: false,
      separators: [
        '.',
        ',',
        ';',
        ':',
        '!',
        '?',
        '—',
        '“',
        '”',
        '‘',
        '’',
        '"',
        "'",
        '-',
        '\n',
      ],
    });

    const docs = await textSplitter.splitDocuments(rawDocs);

    this.vectorDbClient.embedDocuments({
      docs,
      vectorIndexName: process.env.PINECONE_INDEX_NAME,
      vectorNamespace: 'shanur',
    });
  }
}
