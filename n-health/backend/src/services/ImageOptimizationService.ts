import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export interface ImageVariant {
  name: string;
  width: number;
  height: number;
  quality: number;
  format: 'webp' | 'png' | 'jpeg';
}

/**
 * Image optimization service
 * Generates responsive image variants for different contexts and devices
 */
export class ImageOptimizationService {
  private static readonly VARIANTS: Record<string, ImageVariant> = {
    // Thumbnails - for lists and previews
    thumbnail: {
      name: 'thumbnail',
      width: 100,
      height: 100,
      quality: 60,
      format: 'webp'
    },
    // Small - for avatar display
    small: {
      name: 'small',
      width: 150,
      height: 150,
      quality: 70,
      format: 'webp'
    },
    // Medium - for detail pages
    medium: {
      name: 'medium',
      width: 300,
      height: 300,
      quality: 75,
      format: 'webp'
    },
    // Large - for full-size display
    large: {
      name: 'large',
      width: 800,
      height: 800,
      quality: 85,
      format: 'webp'
    }
  };

  /**
   * Generate all image variants from an input buffer
   * @param buffer - Image buffer from upload
   * @param filename - Original filename (used to generate variant names)
   * @returns Object with paths to each variant
   */
  static async generateVariants(
    buffer: Buffer,
    filename: string
  ): Promise<Record<string, string>> {
    const baseName = path.parse(filename).name;
    const variants: Record<string, string> = {};

    for (const [key, config] of Object.entries(this.VARIANTS)) {
      try {
        const variantBuffer = await sharp(buffer)
          .resize(config.width, config.height, {
            fit: 'cover',
            position: 'center'
          })
          [config.format]({ quality: config.quality })
          .toBuffer();

        variants[key] = variantBuffer.toString('base64');
      } catch (error) {
        console.error(`Failed to generate ${key} variant:`, error);
        throw error;
      }
    }

    return variants;
  }

  /**
   * Get the appropriate variant based on context
   * @param context - Where the image will be used (list, detail, full, thumbnail)
   * @returns Variant configuration
   */
  static getVariantForContext(context: 'list' | 'detail' | 'full' | 'thumbnail'): ImageVariant {
    const mapping: Record<string, string> = {
      list: 'thumbnail',
      detail: 'medium',
      full: 'large',
      thumbnail: 'thumbnail'
    };

    const variantKey = mapping[context] || 'medium';
    return this.VARIANTS[variantKey];
  }

  /**
   * Compress a single image to a specific size
   * @param buffer - Image buffer
   * @param variant - Target variant config
   * @returns Compressed image buffer
   */
  static async compressToVariant(
    buffer: Buffer,
    variant: ImageVariant
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize(variant.width, variant.height, {
        fit: 'cover',
        position: 'center'
      })
      [variant.format]({ quality: variant.quality })
      .toBuffer();
  }

  /**
   * Generate a thumbnail preview from a PDF (first page)
   * Useful for lab results and prescriptions
   * @param pdfPath - Path to PDF file
   * @returns PNG buffer of first page
   */
  static async generatePdfThumbnail(pdfPath: string): Promise<Buffer> {
    // This would require pdf-to-image conversion
    // Typically done with pdftoppm or similar CLI tool
    // For now, returning placeholder - should be implemented per deployment needs
    return Buffer.from('');
  }

  /**
   * Get size reduction percentage
   * @param original - Original size in bytes
   * @param compressed - Compressed size in bytes
   * @returns Percentage reduction
   */
  static getSizeReduction(original: number, compressed: number): number {
    return Math.round(((original - compressed) / original) * 100);
  }

  /**
   * Check file size and warn if too large
   * @param buffer - Image buffer
   * @param maxSizeMB - Maximum acceptable size in MB
   * @returns true if within limit
   */
  static validateFileSize(buffer: Buffer, maxSizeMB: number = 10): boolean {
    const sizeMB = buffer.length / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      console.warn(
        `Image size ${sizeMB.toFixed(2)}MB exceeds limit of ${maxSizeMB}MB. Consider reducing or compressing.`
      );
      return false;
    }
    return true;
  }
}

export default ImageOptimizationService;
