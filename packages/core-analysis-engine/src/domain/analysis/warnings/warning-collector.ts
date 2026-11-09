/**
 * Warning Collector for Ripple Analysis Engine.
 *
 * Ensures partial analysis, unresolved imports, parser errors, and deleted files
 * are explicitly communicated to reviewers and dashboard consumers.
 */

export class WarningCollector {
  private warnings: string[] = [];

  public add(warning: string): void {
    if (warning && !this.warnings.includes(warning)) {
      this.warnings.push(warning);
    }
  }

  public addUnresolvedImport(importer: string, specifier: string): void {
    this.add(`Unresolved local import "${specifier}" in ${importer}`);
  }

  public addParseError(file: string, message: string): void {
    this.add(`Parser warning for ${file}: ${message}`);
  }

  public addUnsupportedFile(file: string): void {
    this.add(`Unsupported file type skipped during dependency analysis: ${file}`);
  }

  public addMissingChangedFile(file: string, status?: string): void {
    this.add(
      `Changed file "${file}" (${status || 'modified/deleted'}) was not found in the repository snapshot; impact analysis may be partial.`
    );
  }

  public getAll(): string[] {
    return [...this.warnings];
  }

  public hasWarnings(): boolean {
    return this.warnings.length > 0;
  }
}
