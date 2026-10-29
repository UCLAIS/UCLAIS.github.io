// Local, read-only OCR of publisher-selected image-only PDF pages.
// No networking, document actions, JavaScript, external links or UI prompts.
import Foundation
import PDFKit
import Vision
import CoreGraphics

struct PageText: Codable {
    let page: Int
    let text: String
    let confidence: Double
}

enum OCRFailure: Error { case invalidArguments, unreadablePDF, pageLimit, invalidPage, renderFailed, textLimit }

func main() throws {
guard CommandLine.arguments.count == 2 else { throw OCRFailure.invalidArguments }
let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let document = PDFDocument(url: inputURL), !document.isLocked else { throw OCRFailure.unreadablePDF }
guard document.pageCount > 0, document.pageCount <= 100 else { throw OCRFailure.pageLimit }
var pages: [PageText] = []
var textBytes = 0
for index in 0..<document.pageCount {
    try autoreleasepool {
        guard let page = document.page(at: index) else { throw OCRFailure.invalidPage }
        let bounds = page.bounds(for: .mediaBox)
        guard bounds.width > 0, bounds.height > 0 else { throw OCRFailure.invalidPage }
        let scale = min(1600 / bounds.width, 2400 / bounds.height)
        let width = max(1, Int(bounds.width * scale))
        let height = max(1, Int(bounds.height * scale))
        guard width * height <= 4_000_000,
              let context = CGContext(data: nil, width: width, height: height,
                                      bitsPerComponent: 8, bytesPerRow: width * 4,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { throw OCRFailure.renderFailed }
        context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.scaleBy(x: scale, y: scale)
        context.translateBy(x: -bounds.origin.x, y: -bounds.origin.y)
        page.draw(with: .mediaBox, to: context)
        guard let image = context.makeImage() else { throw OCRFailure.renderFailed }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesCPUOnly = true
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        try handler.perform([request])
        let recognized = (request.results ?? []).compactMap { $0.topCandidates(1).first }
        let text = recognized.map { $0.string }.joined(separator: "\n")
        textBytes += text.utf8.count
        guard textBytes <= 8 * 1024 * 1024 else { throw OCRFailure.textLimit }
        let confidence = recognized.isEmpty ? 0 : recognized.reduce(0) { $0 + Double($1.confidence) } / Double(recognized.count)
        pages.append(PageText(page: index + 1, text: text, confidence: confidence))
    }
}
let output = try JSONEncoder().encode(pages)
FileHandle.standardOutput.write(output)
}

do { try main() }
catch {
    FileHandle.standardError.write(Data("OCR failed: \(error)\n".utf8))
    exit(2)
}
